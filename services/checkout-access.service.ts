import {
  getCheckoutRuntimeState,
  type CheckoutEnvironment,
} from '@/config/checkout';
import { AppError } from '@/lib/errors';

const checkoutDisabledError = () =>
  new AppError(
    '現在オンライン注文の受付準備中です。',
    'CHECKOUT_DISABLED',
    503,
  );

export class CheckoutAccessService {
  public constructor(
    private readonly environment: CheckoutEnvironment = process.env,
  ) {}

  public getStatus() {
    return getCheckoutRuntimeState(this.environment);
  }

  public assertOrderCreationAllowed() {
    if (!this.getStatus().checkoutEnabled) throw checkoutDisabledError();
  }

  public assertMockPaymentAllowed() {
    if (!this.getStatus().mockPaymentEnabled) throw checkoutDisabledError();
  }
}
