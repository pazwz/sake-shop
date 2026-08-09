import { AdminRole } from '@prisma/client';
import { ZodError } from 'zod';
import {
  createAppErrorResponse,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/api-response';
import { AppError, ValidationError } from '@/lib/errors';
import { requireAdmin } from '@/services/admin-authorization.service';
import { OrderService } from '@/services/order.service';
import { adminOrderUpdateValidator } from '@/validators/order.validator';
const service = new OrderService();
export const GET = async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    await requireAdmin();
    return createSuccessResponse(
      await service.getAdminOrder((await params).id),
    );
  } catch (error) {
    if (error instanceof AppError) return createAppErrorResponse(error);
    return createErrorResponse(
      'INTERNAL_SERVER_ERROR',
      'Unable to load order.',
      500,
    );
  }
};
export const PATCH = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    await requireAdmin([AdminRole.OWNER, AdminRole.MANAGER]);
    const input = adminOrderUpdateValidator.parse(await request.json());
    return createSuccessResponse(
      await service.updateStatus((await params).id, input.status),
    );
  } catch (error) {
    if (error instanceof AppError) return createAppErrorResponse(error);
    if (error instanceof ZodError)
      return createAppErrorResponse(new ValidationError());
    return createErrorResponse(
      'INTERNAL_SERVER_ERROR',
      'Unable to update order.',
      500,
    );
  }
};
