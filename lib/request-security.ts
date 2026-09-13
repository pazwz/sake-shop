import { ForbiddenError } from '@/lib/errors';

export const assertSameOriginMutation = (request: Request) => {
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite === 'cross-site')
    throw new ForbiddenError('Request origin is not allowed.');
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) {
    throw new ForbiddenError('Request origin is not allowed.');
  }
};

export const getRequestAttemptKey = (request: Request, identifier: string) =>
  `${request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'}:${identifier.toLowerCase()}`;
