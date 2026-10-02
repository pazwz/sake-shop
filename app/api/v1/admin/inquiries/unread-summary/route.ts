import { createAppErrorResponse, createErrorResponse, createSuccessResponse } from '@/lib/api-response';
import { AppError } from '@/lib/errors';
import { requireAdmin } from '@/services/admin-authorization.service';
import { ContactInquiryService } from '@/services/contact-inquiry.service';

export const GET = async () => {
  try {
    const admin = await requireAdmin();
    return createSuccessResponse(await new ContactInquiryService().unreadSummary(admin.id));
  } catch (error) {
    if (error instanceof AppError) return createAppErrorResponse(error);
    return createErrorResponse('INQUIRY_SUMMARY_FAILED', '未読情報を取得できませんでした。', 500);
  }
};
