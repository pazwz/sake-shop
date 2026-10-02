import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ADMIN_SESSION_COOKIE, readAdminSessionToken } from '@/lib/admin-session';

const readSession = (request: NextRequest) =>
  readAdminSessionToken(request.cookies.get(ADMIN_SESSION_COOKIE)?.value);

const getProductDetailSlug = (pathname: string) => {
  const match = /^\/products\/([^/]+)$/.exec(pathname);
  if (!match) return null;

  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
};

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith('/products/')) {
    const productSlug = getProductDetailSlug(pathname);
    if (!productSlug) {
      return NextResponse.rewrite(new URL('/_not-found', request.url), {
        status: 404,
      });
    }
    if (
      (request.method !== 'GET' && request.method !== 'HEAD') ||
      request.headers.get('rsc') === '1'
    ) {
      return NextResponse.next();
    }

    const previewToken = request.nextUrl.searchParams.get('previewToken');
    if (previewToken) {
      const previewSession = await readSession(request);
      if (previewSession) {
        // The page performs the authoritative admin, token, product ID, and
        // slug checks. This only prevents the public visibility guard from
        // rejecting a legitimate unpublished preview before it reaches SSR.
        return NextResponse.next();
      }
    }

    const { ProductService } = await import('@/services/product.service');
    const productService = new ProductService();
    const isPublic = await productService.isPublicProductSlug(productSlug);
    if (!isPublic) {
      return NextResponse.rewrite(new URL('/_not-found', request.url), {
        status: 404,
      });
    }
    return NextResponse.next();
  }
  if (pathname === '/admin/login') return NextResponse.next();
  if (pathname.startsWith('/api/v1/admin/auth/')) return NextResponse.next();
  const session = await readSession(request);
  if (session) {
    return NextResponse.next();
  }
  if (pathname.startsWith('/api/'))
    return NextResponse.json(
      {
        success: false,
        data: null,
        message: '',
        error: {
          code: 'UNAUTHORIZED',
          detail: 'Administrator authentication is required.',
        },
      },
      { status: 401 },
    );
  const loginUrl = new URL('/admin/login', request.url);
  loginUrl.searchParams.set('next', pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/admin/:path*', '/api/v1/admin/:path*', '/products/:path'],
};
