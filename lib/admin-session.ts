import { jwtVerify, SignJWT } from 'jose';
import { AdminRole } from '@prisma/client';

export const ADMIN_SESSION_COOKIE = 'kura_admin_session';
export const ADMIN_SESSION_MAX_AGE = 60 * 60 * 8;
export const ADMIN_SESSION_IDLE_SECONDS = 60 * 60;

type AdminSession = { adminId: string; role: AdminRole };

const getSessionKey = () => {
  const secret = process.env.ADMIN_SESSION_SECRET ?? process.env.JWT_SECRET;
  if (!secret) throw new Error('An admin session secret is required.');
  return new TextEncoder().encode(secret);
};

export const createAdminSessionToken = async (
  session: AdminSession,
  absolute?: { issuedAt: number; expiresAt: number },
) => {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ ...session, activityAt: now })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(absolute?.issuedAt ?? now)
    .setExpirationTime(absolute?.expiresAt ?? now + ADMIN_SESSION_MAX_AGE)
    .sign(getSessionKey());
};

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
    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.activityAt !== 'number' || typeof payload.iat !== 'number' ||
        typeof payload.exp !== 'number' || !Number.isFinite(payload.activityAt) ||
        payload.activityAt > now || payload.activityAt < payload.iat ||
        payload.exp > payload.iat + ADMIN_SESSION_MAX_AGE ||
        now >= payload.activityAt + ADMIN_SESSION_IDLE_SECONDS) return null;
    return { adminId: payload.adminId, role: payload.role as AdminRole,
      issuedAt: payload.iat, expiresAt: payload.exp, activityAt: payload.activityAt };
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
