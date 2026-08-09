import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const sessionCookie = 'kura_admin_session';
const getKey = () => {
  const secret = process.env.ADMIN_SESSION_SECRET ?? process.env.JWT_SECRET;
  return secret ? new TextEncoder().encode(secret) : null;
};

const readSession = async (request: NextRequest) => {
  const token = request.cookies.get(sessionCookie)?.value;
  const key = getKey();
  if (!token || !key) return null;
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] });
    return typeof payload.role === 'string' ? { role: payload.role } : null;
  } catch {
    return null;
  }
};

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (pathname === '/admin/login') return NextResponse.next();
  if (pathname.startsWith('/api/v1/admin/auth/')) return NextResponse.next();
  const session = await readSession(request);
  if (session) {
    if (
      session.role === 'STAFF' &&
      pathname.startsWith('/admin/collections/')
    ) {
      return NextResponse.redirect(new URL('/admin/collections', request.url));
    }
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

export const config = { matcher: ['/admin/:path*', '/api/v1/admin/:path*'] };
