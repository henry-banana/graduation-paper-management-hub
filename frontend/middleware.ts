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
const LECTURER_ALLOWED_PREFIXES = [
  "/gvhd",
  "/gvpb",
  "/council",
  "/notifications",
  "/profile",
  "/settings",
] as const;
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

type AccountRole = "STUDENT" | "LECTURER" | "TBM";

function isAccountRole(value: string | undefined): value is AccountRole {
  return value === "STUDENT" || value === "LECTURER" || value === "TBM";
}

function isLecturerUiRole(value: string | undefined): boolean {
  return Boolean(value && LECTURER_UI_ROLES.includes(value as (typeof LECTURER_UI_ROLES)[number]));
}

function getCanonicalRole(accountRole: AccountRole, uiRole: string | undefined): string {
  const isProductionRuntime = process.env.NODE_ENV === "production";

  if (accountRole === "STUDENT") {
    return "STUDENT";
  }

  if (accountRole === "TBM") {
    return "TBM";
  }

  if (isProductionRuntime) {
    return "LECTURER";
  }

  // accountRole === 'LECTURER': only accept lecturer-family UI roles.
  if (isLecturerUiRole(uiRole)) {
    return uiRole as string;
  }

  return "GVHD";
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

  if (isStaticPath(pathname)) {
    return NextResponse.next();
  }

  const isAuthenticated = Boolean(request.cookies.get("auth_token")?.value);
  const uiRole = request.cookies.get("user_role")?.value;
  const accountRoleCookie = request.cookies.get("account_role")?.value;
  const accountRole = isAccountRole(accountRoleCookie) ? accountRoleCookie : undefined;

  if (isAuthenticated && !accountRole && pathname !== "/login") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const resolvedRole = accountRole
    ? getCanonicalRole(accountRole, uiRole)
    : "STUDENT";

  if (!isAuthenticated && !isPublicPath(pathname)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isAuthenticated && accountRole && isPublicPath(pathname)) {
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
      allowedPrefixes = LECTURER_ALLOWED_PREFIXES;
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
