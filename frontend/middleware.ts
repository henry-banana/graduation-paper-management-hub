import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_FILE = /\.(.*)$/;

function getRoleHome(role: string): string {
  switch (role) {
    case "STUDENT":
      return "/student/notifications";
    case "GVHD":
    case "GVPB":
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
  const accountRole = request.cookies.get("account_role")?.value;
  const resolvedRole = uiRole || accountRole || "STUDENT";

  if (!isAuthenticated && !isPublicPath(pathname)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isAuthenticated && isPublicPath(pathname)) {
    return NextResponse.redirect(new URL(getRoleHome(resolvedRole), request.url));
  }

  if (pathname === "/") {
    return NextResponse.redirect(new URL(getRoleHome(resolvedRole), request.url));
  }

  if (accountRole === "STUDENT") {
    if (
      pathname.startsWith("/tbm") ||
      pathname.startsWith("/gvhd") ||
      pathname.startsWith("/gvpb") ||
      pathname.startsWith("/council")
    ) {
      return NextResponse.redirect(new URL(getRoleHome("STUDENT"), request.url));
    }
  }

  if (accountRole === "TBM") {
    if (
      pathname.startsWith("/student") ||
      pathname.startsWith("/gvhd") ||
      pathname.startsWith("/gvpb") ||
      pathname.startsWith("/council")
    ) {
      return NextResponse.redirect(new URL(getRoleHome("TBM"), request.url));
    }
  }

  if (accountRole === "LECTURER") {
    if (pathname.startsWith("/student") || pathname.startsWith("/tbm")) {
      return NextResponse.redirect(new URL(getRoleHome("LECTURER"), request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
