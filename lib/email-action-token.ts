import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

const secretFor = (secret = process.env.JWT_SECRET) => {
  if (!secret) throw new Error('EMAIL_TOKEN_SECRET_MISSING');
  return secret;
};

export const createEmailActionToken = (
  id: string,
  purpose: 'verify-email' | 'reset-password' | 'newsletter-unsubscribe',
  secret?: string,
) => {
  const signature = createHmac('sha256', secretFor(secret))
    .update(`${purpose}:${id}`)
    .digest('base64url');
  return `${id}.${signature}`;
};

export const hashEmailActionToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');

export const isValidEmailActionToken = (
  token: string,
  purpose: 'verify-email' | 'reset-password' | 'newsletter-unsubscribe',
  secret?: string,
) => {
  const id = token.split('.')[0];
  if (!id) return false;
  const expected = Buffer.from(createEmailActionToken(id, purpose, secret));
  const provided = Buffer.from(token);
  return (
    expected.length === provided.length && timingSafeEqual(expected, provided)
  );
};
