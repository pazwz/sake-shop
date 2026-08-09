import { AdminRole } from '@prisma/client';
import { ZodError } from 'zod';
import {
  createAppErrorResponse,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/api-response';
import { AppError, ValidationError } from '@/lib/errors';
import { requireAdmin } from '@/services/admin-authorization.service';
import { ShipmentService } from '@/services/shipment.service';
import { shipmentUpdateValidator } from '@/validators/shipment.validator';

const service = new ShipmentService();

export const PATCH = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const admin = await requireAdmin([AdminRole.OWNER, AdminRole.MANAGER]);
    const input = shipmentUpdateValidator.parse(await request.json());
    return createSuccessResponse(
      await service.updateForOrder((await params).id, input, {
        adminUserId: admin.id,
      }),
    );
  } catch (error) {
    if (error instanceof AppError) return createAppErrorResponse(error);
    if (error instanceof ZodError)
      return createAppErrorResponse(new ValidationError());
    return createErrorResponse(
      'INTERNAL_SERVER_ERROR',
      'Unable to update shipment.',
      500,
    );
  }
};
