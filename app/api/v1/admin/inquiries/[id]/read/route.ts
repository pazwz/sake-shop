import { ZodError } from 'zod';
import { createAppErrorResponse, createErrorResponse, createSuccessResponse } from '@/lib/api-response';
import { AppError, ValidationError } from '@/lib/errors';
import { assertSameOriginMutation } from '@/lib/request-security';
import { requireAdmin } from '@/services/admin-authorization.service';
import { ContactInquiryService } from '@/services/contact-inquiry.service';
import { adminInquiryReadValidator } from '@/validators/contact-inquiry.validator';

export const POST = async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  try {
    assertSameOriginMutation(request);
    const admin = await requireAdmin();
    const input = adminInquiryReadValidator.parse(await request.json());
    await new ContactInquiryService().markAdminRead((await params).id, input.messageIds, admin.id);
    return createSuccessResponse({ read: true });
  } catch (error) {
    if (error instanceof AppError) return createAppErrorResponse(error);
    if (error instanceof ZodError) return createAppErrorResponse(new ValidationError());
    return createErrorResponse('INQUIRY_READ_FAILED', '既読情報を保存できませんでした。', 500);
  }
};
