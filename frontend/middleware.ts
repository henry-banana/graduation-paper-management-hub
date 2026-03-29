import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// MOCK: Giả lập auth middleware (Sẽ thay thế bằng AuthGuard sau)
const MOCK_IS_AUTHENTICATED = true;

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Lấy role từ Cookie (Dùng cho quá trình Develop/Test UI)
  const currentRole = request.cookies.get('user_role')?.value || "STUDENT";

  // Các route bỏ qua middleware
  if (pathname.startsWith('/api') || 
      pathname.startsWith('/_next') || 
      pathname.includes('/login') ||
      pathname.includes('/_ipx')) {
    return NextResponse.next()
  }

  // Bắt buộc redirect to login nếu chưa auth
  if (!MOCK_IS_AUTHENTICATED && !pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Điều hướng User về màn hình chính phù hợp nhất với Role
  if (pathname === '/') {
    switch (currentRole) {
      case 'STUDENT': return NextResponse.redirect(new URL('/student/notifications', request.url))
      case 'GVHD': return NextResponse.redirect(new URL('/gvhd/pending', request.url))
      case 'GVPB': return NextResponse.redirect(new URL('/gvpb/reviews', request.url))
      case 'TBM': return NextResponse.redirect(new URL('/tbm/periods', request.url))
      case 'TV_HD': return NextResponse.redirect(new URL('/council/scoring', request.url))
      case 'CT_HD': return NextResponse.redirect(new URL('/council/final-confirm', request.url))
      case 'TK_HD': return NextResponse.redirect(new URL('/council/summary', request.url))
      default: return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
