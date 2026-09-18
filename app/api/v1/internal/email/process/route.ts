import {
  createAppErrorResponse,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/api-response';
import { AppError } from '@/lib/errors';
import { EmailOutboxService } from '@/services/email-outbox.service';
import { EMAIL_OUTBOX_OPERATION } from '@/config/operations';
import { OperationsRunService } from '@/services/operations-run.service';
import { assertCronAuthorization } from '@/services/smaregi/smaregi-sync-access.service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

export const POST = async (request: Request) => {
  try {
    assertCronAuthorization(request.headers.get('authorization'));
    return createSuccessResponse(
      await new OperationsRunService().run(EMAIL_OUTBOX_OPERATION, () =>
        new EmailOutboxService().processDue(),
      ),
    );
  } catch (error) {
    if (error instanceof AppError) return createAppErrorResponse(error);
    return createErrorResponse(
      'EMAIL_PROCESSING_FAILED',
      'メール処理に失敗しました。',
      500,
    );
  }
};
