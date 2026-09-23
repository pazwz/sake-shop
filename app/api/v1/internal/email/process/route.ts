import {
  createAppErrorResponse,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/api-response';
import { AppError, ValidationError } from '@/lib/errors';
import { ZodError, z } from 'zod';
import { EmailOutboxService } from '@/services/email-outbox.service';
import { EMAIL_OUTBOX_OPERATION } from '@/config/operations';
import { OperationsRunService } from '@/services/operations-run.service';
import { assertCronAuthorization } from '@/services/smaregi/smaregi-sync-access.service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const requestValidator = z
  .object({ outboxId: z.string().cuid().optional() })
  .strict();

export const POST = async (request: Request) => {
  try {
    assertCronAuthorization(request.headers.get('authorization'));
    const body = await request.json().catch(() => ({}));
    const input = requestValidator.parse(body);
    return createSuccessResponse(
      await new OperationsRunService().run(EMAIL_OUTBOX_OPERATION, () =>
        input.outboxId
          ? new EmailOutboxService().processOutbox(input.outboxId)
          : new EmailOutboxService().processDue(),
      ),
    );
  } catch (error) {
    if (error instanceof AppError) return createAppErrorResponse(error);
    if (error instanceof ZodError)
      return createAppErrorResponse(new ValidationError('リクエストが不正です。'));
    return createErrorResponse(
      'EMAIL_PROCESSING_FAILED',
      'メール処理に失敗しました。',
      500,
    );
  }
};
