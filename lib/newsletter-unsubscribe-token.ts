import { createCipheriv, createDecipheriv, createHmac } from 'node:crypto';
import {
  createEmailActionToken,
  hashEmailActionToken,
  isValidEmailActionToken,
} from '@/lib/email-action-token';

const PURPOSE = 'newsletter-unsubscribe';
const VERSION = 'n1';
const keyFor = (secret = process.env.JWT_SECRET) => {
  if (!secret) throw new Error('EMAIL_TOKEN_SECRET_MISSING');
  return createHmac('sha256', secret)
    .update('linxas/newsletter/envelope/v1')
    .digest();
};

// Encrypt the existing signed token so legacy stored hashes remain valid without a backfill.
export const createNewsletterUnsubscribeToken = (
  id: string,
  secret?: string,
) => {
  const signed = createEmailActionToken(id, PURPOSE, secret);
  const key = keyFor(secret);
  // Bind the nonce to immutable plaintext with a separate keyed domain.
  // Identical retries retain their request body; different signed tokens get different nonces.
  const iv = createHmac('sha256', key)
    .update(`nonce:${signed}`)
    .digest()
    .subarray(0, 12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(`${PURPOSE}:${VERSION}`));
  const encrypted = Buffer.concat([
    cipher.update(signed, 'utf8'),
    cipher.final(),
  ]);
  return [
    VERSION,
    iv.toString('base64url'),
    encrypted.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
  ].join('.');
};

export const getNewsletterUnsubscribeTokenHash = (
  token: string,
  secret?: string,
): string | null => {
  if (!token || token.length > 500) return null;
  // Missing configuration is an operational error, not an invalid user link.
  const key = keyFor(secret);
  try {
    let signed = token;
    if (token.startsWith(`${VERSION}.`)) {
      const parts = token.split('.');
      if (
        parts.length !== 4 ||
        parts.slice(1).some((part) => !/^[A-Za-z0-9_-]+$/.test(part))
      )
        return null;
      const [iv, encrypted, tag] = parts
        .slice(1)
        .map((part) => Buffer.from(part, 'base64url'));
      if (
        iv.length !== 12 ||
        tag.length !== 16 ||
        parts
          .slice(1)
          .some(
            (part, index) =>
              [iv, encrypted, tag][index].toString('base64url') !== part,
          )
      )
        return null;
      const decipher = createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAAD(Buffer.from(`${PURPOSE}:${VERSION}`));
      decipher.setAuthTag(tag);
      signed = Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
      ]).toString('utf8');
    }
    return isValidEmailActionToken(signed, PURPOSE, secret)
      ? hashEmailActionToken(signed)
      : null;
  } catch {
    return null;
  }
};
