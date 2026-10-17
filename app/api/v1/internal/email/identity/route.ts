import { z, ZodError } from 'zod';
import { createAppErrorResponse, createErrorResponse, createSuccessResponse } from '@/lib/api-response';
import { AppError, ForbiddenError, ValidationError } from '@/lib/errors';
import { EmailIdentityProbeService } from '@/services/email-identity-probe.service';
import { assertCronAuthorization } from '@/services/smaregi/smaregi-sync-access.service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const handle = async (request: Request, cancel: boolean) => {
  try {
    assertCronAuthorization(request.headers.get('authorization'));
    if (process.env.VERCEL_ENV !== 'production') throw new ForbiddenError();
    const body = await request.json().catch(() => { throw new ValidationError(); });
    if (cancel) {
      const input = z.object({ name: z.string().regex(/^email-identity-probe-[0-9a-f-]{36}$/) }).strict().parse(body);
      return createSuccessResponse(await new EmailIdentityProbeService().cancel(input.name));
    }
    z.object({ action: z.literal('create-disabled-schedule') }).strict().parse(body);
    return createSuccessResponse(await new EmailIdentityProbeService().create());
  } catch (error) {
    if (error instanceof AppError) return createAppErrorResponse(error);
    if (error instanceof ZodError) return createAppErrorResponse(new ValidationError());
    // Do not expose OIDC tokens, SDK transport errors or temporary credentials.
    return createErrorResponse('EMAIL_IDENTITY_PROBE_FAILED', 'Identity verification failed.', 503);
  }
};

export const POST = (request: Request) => handle(request, false);
export const DELETE = (request: Request) => handle(request, true);
