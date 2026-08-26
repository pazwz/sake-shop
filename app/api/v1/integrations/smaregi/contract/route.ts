import { ZodError } from 'zod';
import { createErrorResponse } from '@/lib/api-response';
import { SmaregiContractService } from '@/services/smaregi/smaregi-contract.service';
import { smaregiContractRequestValidator } from '@/validators/smaregi.validator';

const service = new SmaregiContractService();

const invalidNotificationResponse = () =>
  createErrorResponse(
    'INVALID_SMAREGI_CONTRACT_NOTIFICATION',
    'Invalid Smaregi contract notification.',
    400,
  );

export const POST = async (request: Request) => {
  try {
    const payload: unknown = await request.json();
    const notification = smaregiContractRequestValidator.parse({
      headers: {
        contentType: request.headers.get('content-type'),
        contractId: request.headers.get('smaregi-contract-id'),
        event: request.headers.get('smaregi-event'),
      },
      body: payload,
    });

    await service.receive(notification.body);
    return new Response(null, { status: 200 });
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof ZodError) {
      return invalidNotificationResponse();
    }
    return createErrorResponse(
      'SMAREGI_CONTRACT_NOTIFICATION_FAILED',
      'Unable to receive Smaregi contract notification.',
      500,
    );
  }
};
