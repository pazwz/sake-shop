import { ZodError } from 'zod';
import {
  createAppErrorResponse,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/api-response';
import { AppError, ValidationError } from '@/lib/errors';
import { requireAdmin } from '@/services/admin-authorization.service';
import { ContactInquiryService } from '@/services/contact-inquiry.service';
import { inquiryListValidator } from '@/validators/contact-inquiry.validator';

const service = new ContactInquiryService();

export const GET = async (request: Request) => {
  try {
    await requireAdmin();
    return createSuccessResponse(
      await service.list(
        inquiryListValidator.parse(
          Object.fromEntries(new URL(request.url).searchParams),
        ),
      ),
    );
  } catch (error) {
    if (error instanceof AppError) return createAppErrorResponse(error);
    if (error instanceof ZodError)
      return createAppErrorResponse(new ValidationError());
    return createErrorResponse(
      'INTERNAL_SERVER_ERROR',
      'お問い合わせを取得できませんでした。',
      500,
    );
  }
};
