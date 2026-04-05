import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_FILE = /\.(.*)$/;

function startsWithAny(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => pathname.startsWith(prefix));
}

const STUDENT_ALLOWED_PREFIXES = ["/student"] as const;
const TBM_ALLOWED_PREFIXES = [
  "/tbm",
  "/exports",
  "/notifications",
  "/profile",
  "/settings",
] as const;
const GVHD_ALLOWED_PREFIXES = ["/gvhd", "/notifications", "/profile", "/settings"] as const;
const GVPB_ALLOWED_PREFIXES = ["/gvpb", "/notifications", "/profile", "/settings"] as const;
const TV_HD_ALLOWED_PREFIXES = [
  "/council/scoring",
  "/notifications",
  "/profile",
  "/settings",
] as const;
const TK_HD_ALLOWED_PREFIXES = [
  "/council/summary",
  "/notifications",
  "/profile",
  "/settings",
] as const;
const CT_HD_ALLOWED_PREFIXES = [
  "/council/final-confirm",
  "/notifications",
  "/profile",
  "/settings",
] as const;

const LECTURER_UI_ROLES = [
  "LECTURER",
  "GVHD",
  "GVPB",
  "TV_HD",
  "TK_HD",
  "CT_HD",
] as const;
const TOPIC_ROLE_VALUES = ["GVHD", "GVPB", "TV_HD", "TK_HD", "CT_HD"] as const;
type TopicRole = (typeof TOPIC_ROLE_VALUES)[number];

type AccountRole = "STUDENT" | "LECTURER" | "TBM";

function isAccountRole(value: string | undefined): value is AccountRole {
  return value === "STUDENT" || value === "LECTURER" || value === "TBM";
}

function isLecturerUiRole(value: string | undefined): boolean {
  return Boolean(value && LECTURER_UI_ROLES.includes(value as (typeof LECTURER_UI_ROLES)[number]));
}

function isTopicRole(value: string): value is TopicRole {
  return TOPIC_ROLE_VALUES.includes(value as TopicRole);
}

function parseTopicRoles(rawCookieValue: string | undefined): Set<TopicRole> {
  if (!rawCookieValue) {
    return new Set<TopicRole>();
  }

  let decoded = rawCookieValue;
  try {
    decoded = decodeURIComponent(rawCookieValue);
  } catch {
    decoded = rawCookieValue;
  }

  const roles = decoded
    .split(",")
    .map((item) => item.trim())
    .filter((item): item is TopicRole => isTopicRole(item));

  return new Set<TopicRole>(roles);
}

function getCanonicalRole(accountRole: AccountRole, uiRole: string | undefined): string {
  if (accountRole === "STUDENT") {
    return "STUDENT";
  }

  if (accountRole === "TBM") {
    return "TBM";
  }

  // accountRole === 'LECTURER': only accept lecturer-family UI roles.
  if (isLecturerUiRole(uiRole)) {
    return uiRole as string;
  }

  return "LECTURER";
}

function getRoleHome(role: string): string {
  switch (role) {
    case "STUDENT":
      return "/student/notifications";
    case "GVPB":
      return "/gvpb/reviews";
    case "GVHD":
    case "LECTURER":
      return "/gvhd/pending";
    case "TBM":
      return "/tbm/periods";
    case "TV_HD":
      return "/council/scoring";
    case "CT_HD":
      return "/council/final-confirm";
    case "TK_HD":
      return "/council/summary";
    default:
      return "/login";
  }
}

function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname.startsWith("/auth/callback") ||
    pathname.startsWith("/auth/error")
  );
}

function isStaticPath(pathname: string): boolean {
  return (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/_ipx") ||
    PUBLIC_FILE.test(pathname)
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAuthCallbackPath = pathname.startsWith("/auth/callback");
  const isLoginPath = pathname === "/login";

  if (isStaticPath(pathname)) {
    return NextResponse.next();
  }

  const isAuthenticated = Boolean(request.cookies.get("auth_token")?.value);
  const uiRole = request.cookies.get("user_role")?.value;
  const topicRoles = parseTopicRoles(request.cookies.get("topic_roles")?.value);
  const accountRoleCookie = request.cookies.get("account_role")?.value;
  const accountRole = isAccountRole(accountRoleCookie) ? accountRoleCookie : undefined;

  // Never short-circuit callback flow; callback page needs to bootstrap session.
  if (isAuthenticated && !accountRole && pathname !== "/login" && !isAuthCallbackPath) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const resolvedRole = accountRole
    ? getCanonicalRole(accountRole, uiRole)
    : "STUDENT";

  if (!isAuthenticated && !isPublicPath(pathname)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isAuthCallbackPath) {
    return NextResponse.next();
  }

  // Keep login reachable to avoid stale-cookie redirect loops.
  if (isLoginPath) {
    return NextResponse.next();
  }

  if (isAuthenticated && accountRole && pathname.startsWith("/auth/error")) {
    return NextResponse.redirect(new URL(getRoleHome(resolvedRole), request.url));
  }

  if (pathname === "/") {
    return NextResponse.redirect(new URL(getRoleHome(resolvedRole), request.url));
  }

  if (accountRole === "STUDENT") {
    if (!startsWithAny(pathname, STUDENT_ALLOWED_PREFIXES)) {
      return NextResponse.redirect(new URL(getRoleHome("STUDENT"), request.url));
    }
  }

  if (accountRole === "TBM") {
    if (!startsWithAny(pathname, TBM_ALLOWED_PREFIXES)) {
      return NextResponse.redirect(new URL(getRoleHome("TBM"), request.url));
    }
  }

  if (accountRole === "LECTURER") {
    let allowedPrefixes: readonly string[] = GVHD_ALLOWED_PREFIXES;

    if (resolvedRole === "LECTURER") {
      // For base lecturers, grant shared routes and unlock role-specific routes
      // only when the lecturer is actually assigned to that topic role.
      const dynamicPrefixes = new Set<string>(GVHD_ALLOWED_PREFIXES);
      if (topicRoles.has("GVPB")) {
        GVPB_ALLOWED_PREFIXES.forEach((prefix) => dynamicPrefixes.add(prefix));
      }
      if (topicRoles.has("TV_HD")) {
        TV_HD_ALLOWED_PREFIXES.forEach((prefix) => dynamicPrefixes.add(prefix));
      }
      if (topicRoles.has("TK_HD")) {
        TK_HD_ALLOWED_PREFIXES.forEach((prefix) => dynamicPrefixes.add(prefix));
      }
      if (topicRoles.has("CT_HD")) {
        CT_HD_ALLOWED_PREFIXES.forEach((prefix) => dynamicPrefixes.add(prefix));
      }
      allowedPrefixes = Array.from(dynamicPrefixes);
    } else if (resolvedRole === "GVPB") {
      allowedPrefixes = GVPB_ALLOWED_PREFIXES;
    } else if (resolvedRole === "TV_HD") {
      allowedPrefixes = TV_HD_ALLOWED_PREFIXES;
    } else if (resolvedRole === "TK_HD") {
      allowedPrefixes = TK_HD_ALLOWED_PREFIXES;
    } else if (resolvedRole === "CT_HD") {
      allowedPrefixes = CT_HD_ALLOWED_PREFIXES;
    }

    if (!startsWithAny(pathname, allowedPrefixes)) {
      return NextResponse.redirect(new URL(getRoleHome(resolvedRole), request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
