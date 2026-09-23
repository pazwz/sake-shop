import {
  createAppErrorResponse,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/api-response';
import { AppError } from '@/lib/errors';
import { requireAdmin } from '@/services/admin-authorization.service';
import { ContactInquiryService } from '@/services/contact-inquiry.service';

const service = new ContactInquiryService();
export const GET = async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    await requireAdmin();
    return createSuccessResponse(await service.get((await params).id));
  } catch (error) {
    if (error instanceof AppError) return createAppErrorResponse(error);
    return createErrorResponse(
      'INTERNAL_SERVER_ERROR',
      'お問い合わせを取得できませんでした。',
      500,
    );
  }
};
