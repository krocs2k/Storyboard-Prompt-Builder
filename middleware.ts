import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;

    // Serve bundled/default images through the CDN-aware route so they still
    // resolve when the static public/images files are missing (e.g. on the
    // self-hosted build that drops the public/ folder). The /api/category-images
    // handler serves from local disk first and falls back to BunnyCDN.
    if (pathname.startsWith('/images/')) {
      const url = req.nextUrl.clone();
      url.pathname = '/api/category-images' + pathname.slice('/images'.length);
      return NextResponse.rewrite(url);
    }

    // Allow access to pending-approval page
    if (pathname === '/pending-approval') {
      return NextResponse.next();
    }

    // Check if user is active (not pending approval)
    if (token && token.isActive === false) {
      // Redirect inactive users to pending approval page
      return NextResponse.redirect(new URL('/pending-approval', req.url));
    }

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
        const publicRoutes = ['/login', '/register', '/verify-email', '/pending-approval', '/invite/accept'];
        const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));

        // Bundled/default images are public visual assets (rewritten to the
        // public /api/category-images route inside the middleware function).
        if (pathname.startsWith('/images/')) {
          return true;
        }
        
        // API routes that should be public
        const publicApiRoutes = [
          '/api/auth',
          '/api/signup',
          '/api/invite/accept',
          '/api/admin/users/signup-setting',
          '/api/health',
          '/api/category-images'
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
    '/((?!_next/static|_next/image|favicon.ico|favicon.svg|favicon-16x16.png|favicon-32x32.png|icon-192x192.png|icon-512x512.png|apple-touch-icon.png|robots.txt|og-image.png|manifest.json|sw.js).*)',
  ]
};
