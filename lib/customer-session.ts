import { createHash, randomBytes } from 'node:crypto';

export const createCustomerSessionToken = () =>
  randomBytes(32).toString('base64url');

export const hashCustomerSessionToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');
