import { createErrorResponse, createSuccessResponse } from '@/lib/api-response';
import { getCurrentCustomer } from '@/services/customer-authorization.service';

export const GET = async () => {
  try {
    const customer = await getCurrentCustomer();
    return customer
      ? createSuccessResponse(customer)
      : createErrorResponse(
          'UNAUTHORIZED',
          'Customer authentication is required.',
          401,
        );
  } catch {
    return createErrorResponse(
      'INTERNAL_SERVER_ERROR',
      'Unable to load customer session.',
      500,
    );
  }
};
