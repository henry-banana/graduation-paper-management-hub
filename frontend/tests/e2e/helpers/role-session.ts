import type { Page } from "@playwright/test";

export type AccountRole = "STUDENT" | "LECTURER" | "TBM";
export type UiRole =
  | "STUDENT"
  | "LECTURER"
  | "GVHD"
  | "GVPB"
  | "TV_HD"
  | "TK_HD"
  | "CT_HD"
  | "TBM";

const API_PATH_PREFIX = "/api/v1";
const MOCKED_PAGES = new WeakSet<Page>();

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function buildListPayload(searchParams: URLSearchParams) {
  return {
    data: [],
    pagination: {
      page: parsePositiveInt(searchParams.get("page"), 1),
      size: parsePositiveInt(searchParams.get("size"), 100),
      total: 0,
    },
  };
}

function getAccountRoleFromCookie(cookieHeader: string | null): AccountRole {
  if (!cookieHeader) {
    return "STUDENT";
  }

  const match = cookieHeader.match(/(?:^|;\s*)account_role=([^;]+)/i);
  const rawValue = match ? decodeURIComponent(match[1]) : null;

  if (rawValue === "LECTURER" || rawValue === "TBM" || rawValue === "STUDENT") {
    return rawValue;
  }

  return "STUDENT";
}

function buildMockPayload(
  method: string,
  apiPath: string,
  searchParams: URLSearchParams,
  accountRole: AccountRole,
) {
  if (method === "GET") {
    if (apiPath === "/notifications/unread-count") {
      return { data: { unreadCount: 0 } };
    }

    if (apiPath === "/users/me") {
      return {
        data: {
          id: "e2e-user",
          email: "e2e@example.com",
          fullName: "E2E Test User",
          accountRole,
        },
      };
    }

    if (apiPath === "/notifications") {
      return buildListPayload(searchParams);
    }

    if (apiPath.startsWith("/notifications/")) {
      const id = apiPath.split("/").pop() || "notification-e2e";
      return {
        data: {
          id,
          title: "Thông báo thử nghiệm",
          message: "",
          readAt: null,
          createdAt: new Date().toISOString(),
        },
      };
    }

    if (apiPath === "/topics" || apiPath === "/periods" || apiPath === "/users" || apiPath === "/exports") {
      return buildListPayload(searchParams);
    }

    if (apiPath.includes("/assignments")) {
      return { data: [] };
    }

    if (apiPath.endsWith("/submissions")) {
      return { data: [] };
    }

    if (apiPath.endsWith("/scores/my-draft")) {
      return { data: {} };
    }

    return { data: {} };
  }

  if (method === "PATCH") {
    return { data: { updated: true } };
  }

  if (method === "DELETE") {
    return { data: { deleted: true } };
  }

  return { data: {} };
}

async function ensureApiMock(page: Page) {
  if (MOCKED_PAGES.has(page)) {
    return;
  }

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (!url.pathname.startsWith(API_PATH_PREFIX)) {
      await route.continue();
      return;
    }

    const apiPath = url.pathname.slice(API_PATH_PREFIX.length) || "/";
    const cookieHeader = await request.headerValue("cookie");
    const accountRole = getAccountRoleFromCookie(cookieHeader);
    const payload = buildMockPayload(request.method(), apiPath, url.searchParams, accountRole);

    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify(payload),
    });
  });

  MOCKED_PAGES.add(page);
}

export async function seedRoleSession(
  page: Page,
  baseURL: string,
  accountRole: AccountRole,
  uiRole: UiRole,
) {
  await ensureApiMock(page);

  const parsedBaseUrl = new URL(baseURL);

  await page.context().addCookies([
    {
      name: "auth_token",
      value: "1",
      domain: parsedBaseUrl.hostname,
      path: "/",
      sameSite: "Lax",
      secure: false,
    },
    {
      name: "account_role",
      value: accountRole,
      domain: parsedBaseUrl.hostname,
      path: "/",
      sameSite: "Lax",
      secure: false,
    },
    {
      name: "user_role",
      value: uiRole,
      domain: parsedBaseUrl.hostname,
      path: "/",
      sameSite: "Lax",
      secure: false,
    },
  ]);

  await page.addInitScript(
    ({ seededAccountRole, seededUiRole }) => {
      const expiresAt = Date.now() + 60 * 60 * 1000;

      localStorage.setItem("kltn_access_token", "e2e-access-token");
      localStorage.setItem("kltn_refresh_token", "e2e-refresh-token");
      localStorage.setItem("kltn_expires_at", String(expiresAt));
      localStorage.setItem("kltn_account_role", seededAccountRole);
      localStorage.setItem("kltn_user_role", seededUiRole);
      localStorage.setItem(
        "kltn_profile",
        JSON.stringify({
          id: "e2e-user",
          email: "e2e@example.com",
          fullName: "E2E Test User",
          accountRole: seededAccountRole,
        }),
      );
    },
    { seededAccountRole: accountRole, seededUiRole: uiRole },
  );
}
