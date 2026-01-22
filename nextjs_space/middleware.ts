import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;

    // Admin routes require admin role
    if (pathname.startsWith('/admin')) {
      if (token?.role !== 'admin') {
        return NextResponse.redirect(new URL('/', req.url));
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const pathname = req.nextUrl.pathname;
        
        // Public routes that don't require authentication
        const publicRoutes = ['/login', '/register', '/verify-email'];
        const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));
        
        // API routes that should be public
        const publicApiRoutes = [
          '/api/auth',
          '/api/signup'
        ];
        const isPublicApi = publicApiRoutes.some(route => pathname.startsWith(route));
        
        if (isPublicRoute || isPublicApi) {
          return true;
        }

        // All other routes require authentication
        return !!token;
      }
    }
  }
);

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|images|robots.txt|og-image.png|favicon.svg).*)',
  ]
};
