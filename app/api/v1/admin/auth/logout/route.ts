import { createSuccessResponse } from '@/lib/api-response';
import {
  ADMIN_SESSION_COOKIE,
  adminSessionCookieOptions,
} from '@/lib/admin-session';

export const POST = () => {
  const response = createSuccessResponse({ loggedOut: true });
  response.cookies.set(ADMIN_SESSION_COOKIE, '', {
    ...adminSessionCookieOptions(),
    maxAge: 0,
  });
  return response;
};
