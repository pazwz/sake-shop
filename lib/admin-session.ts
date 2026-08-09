import { jwtVerify, SignJWT } from 'jose';
import { AdminRole } from '@prisma/client';

export const ADMIN_SESSION_COOKIE = 'kura_admin_session';
export const ADMIN_SESSION_MAX_AGE = 60 * 60 * 8;

type AdminSession = { adminId: string; role: AdminRole };

const getSessionKey = () => {
  const secret = process.env.ADMIN_SESSION_SECRET ?? process.env.JWT_SECRET;
  if (!secret) throw new Error('An admin session secret is required.');
  return new TextEncoder().encode(secret);
};

export const createAdminSessionToken = async (session: AdminSession) =>
  new SignJWT(session)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${ADMIN_SESSION_MAX_AGE}s`)
    .sign(getSessionKey());

export const readAdminSessionToken = async (token?: string) => {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSessionKey(), {
      algorithms: ['HS256'],
    });
    if (
      typeof payload.adminId !== 'string' ||
      typeof payload.role !== 'string'
    ) {
      return null;
    }
    if (!Object.values(AdminRole).includes(payload.role as AdminRole))
      return null;
    return { adminId: payload.adminId, role: payload.role as AdminRole };
  } catch {
    return null;
  }
};

export const adminSessionCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: ADMIN_SESSION_MAX_AGE,
});
