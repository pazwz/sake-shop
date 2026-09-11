import { jwtVerify, SignJWT } from 'jose';

const PREVIEW_AUDIENCE = 'linxas-admin-product-preview';
const PREVIEW_MAX_AGE_SECONDS = 5 * 60;

const getPreviewKey = () => {
  const secret = process.env.ADMIN_SESSION_SECRET ?? process.env.JWT_SECRET;
  if (!secret) throw new Error('An admin session secret is required.');
  return new TextEncoder().encode(secret);
};

export const createAdminProductPreviewToken = async (input: {
  productId: string;
  adminId: string;
}) =>
  new SignJWT(input)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setAudience(PREVIEW_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${PREVIEW_MAX_AGE_SECONDS}s`)
    .sign(getPreviewKey());

export const readAdminProductPreviewToken = async (token: string) => {
  try {
    const { payload } = await jwtVerify(token, getPreviewKey(), {
      algorithms: ['HS256'],
      audience: PREVIEW_AUDIENCE,
    });
    if (
      typeof payload.productId !== 'string' ||
      typeof payload.adminId !== 'string'
    )
      return null;
    return { productId: payload.productId, adminId: payload.adminId };
  } catch {
    return null;
  }
};
