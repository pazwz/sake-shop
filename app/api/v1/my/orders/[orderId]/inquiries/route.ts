import { ZodError } from 'zod';
import {
  createAppErrorResponse,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/api-response';
import { AppError, ValidationError } from '@/lib/errors';
import { assertSameOriginMutation } from '@/lib/request-security';
import { requireCustomer } from '@/services/customer-authorization.service';
import { ContactInquiryService } from '@/services/contact-inquiry.service';
import { customerInquiryCreateValidator } from '@/validators/contact-inquiry.validator';

const service = new ContactInquiryService();

export const POST = async (
  request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) => {
  try {
    assertSameOriginMutation(request);
    const customer = await requireCustomer();
    const input = customerInquiryCreateValidator.parse(await request.json());
    return createSuccessResponse(
      await service.startOrderSupport(
        (await params).orderId,
        input.message,
        customer.id,
      ),
      201,
    );
  } catch (error) {
    if (error instanceof AppError) return createAppErrorResponse(error);
    if (error instanceof ZodError)
      return createAppErrorResponse(
        new ValidationError('入力内容を確認してください。'),
      );
    return createErrorResponse(
      'ORDER_INQUIRY_CREATE_FAILED',
      'メッセージを送信できませんでした。',
      500,
    );
  }
};
