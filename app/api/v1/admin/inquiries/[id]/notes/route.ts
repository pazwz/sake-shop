import { ZodError } from 'zod';
import {
  createAppErrorResponse,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/api-response';
import { AppError, ValidationError } from '@/lib/errors';
import { requireAdmin } from '@/services/admin-authorization.service';
import { ContactInquiryService } from '@/services/contact-inquiry.service';
import { inquiryNoteValidator } from '@/validators/contact-inquiry.validator';
const service = new ContactInquiryService();
export const POST = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const admin = await requireAdmin();
    const input = inquiryNoteValidator.parse(await request.json());
    return createSuccessResponse(
      await service.addNote((await params).id, input.body, admin.id),
      201,
    );
  } catch (error) {
    if (error instanceof AppError) return createAppErrorResponse(error);
    if (error instanceof ZodError)
      return createAppErrorResponse(new ValidationError());
    return createErrorResponse(
      'INTERNAL_SERVER_ERROR',
      '内部メモを追加できませんでした。',
      500,
    );
  }
};
