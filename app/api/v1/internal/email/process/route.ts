import {
  createAppErrorResponse,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/api-response';
import { AppError, ValidationError } from '@/lib/errors';
import { ZodError, z } from 'zod';
import { EmailEventService } from '@/services/email-event.service';
import { EmailEventTransport, emailEventValidator } from '@/services/email-event-transport.service';
import { EMAIL_OUTBOX_OPERATION } from '@/config/operations';
import { OperationsRunService } from '@/services/operations-run.service';
import { assertCronAuthorization } from '@/services/smaregi/smaregi-sync-access.service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const requestValidator = z
  .object({ outboxId: z.string().cuid().optional(), event: emailEventValidator.optional() })
  .strict()
  .refine((input) => !(input.outboxId && input.event));

export const POST = async (request: Request) => {
  try {
    assertCronAuthorization(request.headers.get('authorization'));
    const body = await request.json().catch(() => {
      throw new ValidationError('リクエストが不正です。');
    });
    const input = requestValidator.parse(body);
    return createSuccessResponse(
      await new OperationsRunService().run(EMAIL_OUTBOX_OPERATION, async () => {
        if (input.event) return new EmailEventService().handle(input.event);
        if (input.outboxId) {
          await new EmailEventTransport().publish({ kind: 'outbox', outboxId: input.outboxId });
          return { outcome: 'QUEUED', processed: 1, sent: 0, failed: 0 };
        }
        return new EmailEventService().enqueueDue();
      }),
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
