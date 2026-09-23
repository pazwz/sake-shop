import { ZodError } from 'zod';
import {
  createAppErrorResponse,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/api-response';
import { AppError, ValidationError } from '@/lib/errors';
import { requireAdmin } from '@/services/admin-authorization.service';
import { ContactInquiryService } from '@/services/contact-inquiry.service';
import { inquiryStatusValidator } from '@/validators/contact-inquiry.validator';
const service = new ContactInquiryService();
export const PATCH = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const admin = await requireAdmin();
    const input = inquiryStatusValidator.parse(await request.json());
    return createSuccessResponse(
      await service.updateStatus((await params).id, input.status, admin),
    );
  } catch (error) {
    if (error instanceof AppError) return createAppErrorResponse(error);
    if (error instanceof ZodError)
      return createAppErrorResponse(new ValidationError());
    return createErrorResponse(
      'INTERNAL_SERVER_ERROR',
      'ステータスを更新できませんでした。',
      500,
    );
  }
};
