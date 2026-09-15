import { ZodError } from 'zod';
import {
  createAppErrorResponse,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/api-response';
import { AppError, ValidationError } from '@/lib/errors';
import { assertSameOriginMutation } from '@/lib/request-security';
import { CustomerAddressService } from '@/services/customer-address.service';
import { requireCustomer } from '@/services/customer-authorization.service';
import { customerAddressValidator } from '@/validators/customer-account.validator';

const service = new CustomerAddressService();
type Context = { params: Promise<{ id: string }> };

export const GET = async (_request: Request, context: Context) => {
  try {
    const customer = await requireCustomer();
    return createSuccessResponse(
      await service.getOwnedAddress(customer.id, (await context.params).id),
    );
  } catch (error) {
    if (error instanceof AppError) return createAppErrorResponse(error);
    return createErrorResponse(
      'ADDRESS_READ_FAILED',
      'お届け先を取得できませんでした。',
      500,
    );
  }
};

export const PATCH = async (request: Request, context: Context) => {
  try {
    assertSameOriginMutation(request);
    const customer = await requireCustomer();
    const input = customerAddressValidator.parse(await request.json());
    return createSuccessResponse(
      await service.update(customer.id, (await context.params).id, input),
    );
  } catch (error) {
    if (error instanceof ZodError)
      return createAppErrorResponse(new ValidationError());
    if (error instanceof AppError) return createAppErrorResponse(error);
    return createErrorResponse(
      'ADDRESS_UPDATE_FAILED',
      'お届け先を更新できませんでした。',
      500,
    );
  }
};

export const DELETE = async (request: Request, context: Context) => {
  try {
    assertSameOriginMutation(request);
    const customer = await requireCustomer();
    return createSuccessResponse(
      await service.delete(customer.id, (await context.params).id),
    );
  } catch (error) {
    if (error instanceof AppError) return createAppErrorResponse(error);
    return createErrorResponse(
      'ADDRESS_DELETE_FAILED',
      'お届け先を削除できませんでした。',
      500,
    );
  }
};
