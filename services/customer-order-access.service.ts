import { UnauthorizedError } from '@/lib/errors';

/**
 * Temporary fail-closed boundary for consumer order reads.
 *
 * Replace this gate with a trusted server-side Customer Session and an
 * ownership-scoped repository query when Customer authentication is added.
 */
export class CustomerOrderAccessService {
  public async getOrderDetail(_orderIdentifier: string): Promise<never> {
    throw new UnauthorizedError(
      'Customer authentication is required to view order details.',
    );
  }
}
