export type AccountRole = "STUDENT" | "LECTURER" | "TBM";
export type UiRole =
  | "STUDENT"
  | "LECTURER"
  | "GVHD"
  | "GVPB"
  | "TBM"
  | "TV_HD"
  | "CT_HD"
  | "TK_HD";

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  accountRole: AccountRole;
}

interface AuthSessionPayload {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  profile?: UserProfile;
}

const ACCESS_TOKEN_KEY = "kltn_access_token";
const REFRESH_TOKEN_KEY = "kltn_refresh_token";
const EXPIRES_AT_KEY = "kltn_expires_at";
const ACCOUNT_ROLE_KEY = "kltn_account_role";
const USER_ROLE_KEY = "kltn_user_role";
const PROFILE_KEY = "kltn_profile";

const AUTH_COOKIE = "auth_token";
const ACCOUNT_ROLE_COOKIE = "account_role";
const USER_ROLE_COOKIE = "user_role";

const UI_ROLES: readonly UiRole[] = [
  "STUDENT",
  "LECTURER",
  "GVHD",
  "GVPB",
  "TBM",
  "TV_HD",
  "CT_HD",
  "TK_HD",
] as const;

function isUiRole(value: string | null): value is UiRole {
  return Boolean(value && UI_ROLES.includes(value as UiRole));
}

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function setCookie(name: string, value: string, maxAgeSeconds: number) {
  if (!isBrowser()) {
    return;
  }

  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; samesite=lax`;
}

function clearCookie(name: string) {
  if (!isBrowser()) {
    return;
  }

  document.cookie = `${name}=; path=/; max-age=0; samesite=lax`;
}

function getCookie(name: string): string | null {
  if (!isBrowser()) {
    return null;
  }

  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
}

export function mapAccountRoleToUiRole(accountRole: AccountRole): UiRole {
  switch (accountRole) {
    case "STUDENT":
      return "STUDENT";
    case "TBM":
      return "TBM";
    case "LECTURER":
    default:
      return "GVHD";
  }
}

export function setCurrentRoles(accountRole: AccountRole, uiRole?: UiRole) {
  if (!isBrowser()) {
    return;
  }

  const resolvedUiRole = uiRole ?? mapAccountRoleToUiRole(accountRole);
  localStorage.setItem(ACCOUNT_ROLE_KEY, accountRole);
  localStorage.setItem(USER_ROLE_KEY, resolvedUiRole);

  const maxAgeSeconds = 7 * 24 * 60 * 60;
  setCookie(ACCOUNT_ROLE_COOKIE, accountRole, maxAgeSeconds);
  setCookie(USER_ROLE_COOKIE, resolvedUiRole, maxAgeSeconds);
}

export function setUserProfile(profile: UserProfile) {
  if (!isBrowser()) {
    return;
  }

  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  setCurrentRoles(profile.accountRole);
}

export function getUserProfile(): UserProfile | null {
  if (!isBrowser()) {
    return null;
  }

  const raw = localStorage.getItem(PROFILE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
}

export function getCurrentAccountRole(): AccountRole | null {
  if (!isBrowser()) {
    return null;
  }

  const stored = localStorage.getItem(ACCOUNT_ROLE_KEY);
  if (stored === "STUDENT" || stored === "LECTURER" || stored === "TBM") {
    return stored;
  }

  const cookieValue = getCookie(ACCOUNT_ROLE_COOKIE);
  if (
    cookieValue === "STUDENT" ||
    cookieValue === "LECTURER" ||
    cookieValue === "TBM"
  ) {
    return cookieValue;
  }

  return null;
}

export function getCurrentUiRole(): UiRole {
  if (!isBrowser()) {
    return "STUDENT";
  }

  const cookieValue = getCookie(USER_ROLE_COOKIE);
  if (isUiRole(cookieValue)) {
    return cookieValue;
  }

  const stored = localStorage.getItem(USER_ROLE_KEY);
  if (isUiRole(stored)) {
    return stored;
  }

  return "STUDENT";
}

export function setAuthSession(payload: AuthSessionPayload) {
  if (!isBrowser()) {
    return;
  }

  const expiresAt = Date.now() + payload.expiresIn * 1000;

  localStorage.setItem(ACCESS_TOKEN_KEY, payload.accessToken);
  localStorage.setItem(EXPIRES_AT_KEY, String(expiresAt));

  if (payload.refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, payload.refreshToken);
  }

  const safeMaxAge = Math.max(payload.expiresIn, 60);
  setCookie(AUTH_COOKIE, "1", safeMaxAge);

  if (payload.profile) {
    setUserProfile(payload.profile);
  }
}

export function updateAccessToken(accessToken: string, expiresIn: number) {
  if (!isBrowser()) {
    return;
  }

  const expiresAt = Date.now() + expiresIn * 1000;
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(EXPIRES_AT_KEY, String(expiresAt));
  setCookie(AUTH_COOKIE, "1", Math.max(expiresIn, 60));
}

export function getAccessToken(): string | null {
  if (!isBrowser()) {
    return null;
  }

  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (!isBrowser()) {
    return null;
  }

  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function isAccessTokenExpired(bufferMs = 30_000): boolean {
  if (!isBrowser()) {
    return true;
  }

  const expiresAtRaw = localStorage.getItem(EXPIRES_AT_KEY);
  if (!expiresAtRaw) {
    return true;
  }

  const expiresAt = Number(expiresAtRaw);
  if (Number.isNaN(expiresAt)) {
    return true;
  }

  return Date.now() + bufferMs >= expiresAt;
}

export function clearAuthSession() {
  if (!isBrowser()) {
    return;
  }

  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(EXPIRES_AT_KEY);
  localStorage.removeItem(ACCOUNT_ROLE_KEY);
  localStorage.removeItem(USER_ROLE_KEY);
  localStorage.removeItem(PROFILE_KEY);

  clearCookie(AUTH_COOKIE);
  clearCookie(ACCOUNT_ROLE_COOKIE);
  clearCookie(USER_ROLE_COOKIE);
}
