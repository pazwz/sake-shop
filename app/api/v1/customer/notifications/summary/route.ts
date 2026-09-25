import { createAppErrorResponse, createErrorResponse, createSuccessResponse } from '@/lib/api-response';
import { AppError } from '@/lib/errors';
import { requireCustomer } from '@/services/customer-authorization.service';
import { CustomerNotificationService } from '@/services/customer-notification.service';
const service = new CustomerNotificationService();
export const GET = async () => { try { const customer = await requireCustomer(); return createSuccessResponse(await service.summary(customer.id)); } catch (error) { if (error instanceof AppError) return createAppErrorResponse(error); return createErrorResponse('NOTIFICATIONS_FAILED', 'お知らせを取得できませんでした。', 500); } };
