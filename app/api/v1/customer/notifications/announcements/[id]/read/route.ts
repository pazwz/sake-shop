import { createAppErrorResponse, createErrorResponse, createSuccessResponse } from '@/lib/api-response';
import { AppError } from '@/lib/errors';
import { assertSameOriginMutation } from '@/lib/request-security';
import { requireCustomer } from '@/services/customer-authorization.service';
import { CustomerNotificationService } from '@/services/customer-notification.service';
const service = new CustomerNotificationService();
export const POST = async (request: Request, { params }: { params: Promise<{ id: string }> }) => { try { assertSameOriginMutation(request); const customer = await requireCustomer(); await service.markAnnouncementRead((await params).id, customer.id); return createSuccessResponse({}); } catch (error) { if (error instanceof AppError) return createAppErrorResponse(error); return createErrorResponse('ANNOUNCEMENT_READ_FAILED', 'お知らせを更新できませんでした。', 500); } };
