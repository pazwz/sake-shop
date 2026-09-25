import { createAppErrorResponse, createErrorResponse, createSuccessResponse } from '@/lib/api-response';
import { AppError } from '@/lib/errors';
import { assertSameOriginMutation } from '@/lib/request-security';
import { requireCustomer } from '@/services/customer-authorization.service';
import { ContactInquiryService } from '@/services/contact-inquiry.service';

const service = new ContactInquiryService();
export const POST = async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  try {
    assertSameOriginMutation(request);
    const customer = await requireCustomer();
    await service.markCustomerRead((await params).id, customer.id);
    return createSuccessResponse({});
  } catch (error) {
    if (error instanceof AppError) return createAppErrorResponse(error);
    return createErrorResponse('ORDER_INQUIRY_READ_FAILED', 'メッセージを更新できませんでした。', 500);
  }
};
