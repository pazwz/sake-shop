import CheckoutForm from '@/components/checkout-form';
import { getCheckoutRuntimeState } from '@/config/checkout';

export default function CheckoutPage() {
  const { checkoutEnabled } = getCheckoutRuntimeState();
  return <CheckoutForm checkoutEnabled={checkoutEnabled} />;
}
