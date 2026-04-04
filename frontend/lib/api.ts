import {
  clearAuthSession,
  getAccessToken,
  getRefreshToken,
  isAccessTokenExpired,
  updateAccessToken,
} from "@/lib/auth/session";

export interface ApiMeta {
  requestId?: string;
}

export interface ApiPagination {
  page: number;
  size: number;
  total: number;
}

export interface ApiResponse<T> {
  data: T;
  meta?: ApiMeta;
}

export interface ApiListResponse<T> {
  data: T[];
  pagination: ApiPagination;
  meta?: ApiMeta;
}

interface ProblemDetail {
  title?: string;
  detail?: string;
  message?: string;
  status?: number;
}

export class ApiRequestError extends Error {
  readonly status: number;
  readonly detail?: ProblemDetail;

  constructor(message: string, status: number, detail?: ProblemDetail) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.detail = detail;
  }
}

interface RefreshResponse {
  data: {
    accessToken: string;
    expiresIn: number;
  };
}

export function getApiBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "http://localhost:3001/api/v1"
  );
}

class ApiClient {
  private token: string | null = null;
  private refreshPromise: Promise<void> | null = null;
  private authFailureRedirecting = false;

  setToken(token: string) {
    this.token = token;
    this.authFailureRedirecting = false;
  }

  clearToken() {
    this.token = null;
  }

  private resolveAccessToken(): string | null {
    if (this.token && !isAccessTokenExpired()) {
      this.authFailureRedirecting = false;
      return this.token;
    }

    const stored = getAccessToken();
    this.token = stored;
    if (stored && !isAccessTokenExpired()) {
      this.authFailureRedirecting = false;
    }
    return stored;
  }

  private handleAuthFailure(message: string): never {
    clearAuthSession();
    this.clearToken();

    if (typeof window !== "undefined" && !this.authFailureRedirecting) {
      this.authFailureRedirecting = true;
      if (window.location.pathname !== "/login") {
        window.location.assign("/login?reason=session-expired");
      }
    }

    throw new Error(message);
  }

  private async tryRefreshToken(): Promise<void> {
    if (this.refreshPromise) {
      await this.refreshPromise;
      return;
    }

    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      return this.handleAuthFailure("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
    }

    this.refreshPromise = (async () => {
      const response = await fetch(`${getApiBaseUrl()}/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refreshToken }),
        credentials: "include",
      });

      if (!response.ok) {
        return this.handleAuthFailure("Không thể làm mới phiên đăng nhập.");
      }

      const payload = (await response.json()) as RefreshResponse;
      updateAccessToken(payload.data.accessToken, payload.data.expiresIn);
      this.token = payload.data.accessToken;
      this.authFailureRedirecting = false;
    })();

    try {
      await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  private toError(payload: unknown, status: number): Error {
    const detail = payload as ProblemDetail | undefined;
    const message =
      detail?.detail ||
      detail?.message ||
      detail?.title ||
      `Request failed with status ${status}`;
    return new ApiRequestError(message, status, detail);
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    canRetryAuth = true,
  ): Promise<T> {
    const headers = new Headers(options.headers || {});
    const isFormDataBody = typeof FormData !== "undefined" && options.body instanceof FormData;

    if (!isFormDataBody && options.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const token = this.resolveAccessToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    const response = await fetch(`${getApiBaseUrl()}${endpoint}`, {
      ...options,
      headers,
      credentials: "include",
    });

    if (response.status === 401 && canRetryAuth) {
      await this.tryRefreshToken();
      return this.request<T>(endpoint, options, false);
    }

    if (response.status === 401 && !canRetryAuth) {
      return this.handleAuthFailure("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
    }

    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json")
      ? await response.json()
      : null;

    if (!response.ok) {
      throw this.toError(payload, response.status);
    }

    return payload as T;
  }

  get<T>(endpoint: string) {
    return this.request<T>(endpoint);
  }

  post<T>(endpoint: string, data: unknown) {
    return this.request<T>(endpoint, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  postForm<T>(endpoint: string, formData: FormData) {
    return this.request<T>(endpoint, {
      method: "POST",
      body: formData,
    });
  }

  patch<T>(endpoint: string, data: unknown) {
    return this.request<T>(endpoint, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  delete<T>(endpoint: string) {
    return this.request<T>(endpoint, { method: "DELETE" });
  }
}

export const api = new ApiClient();
