import { redirect } from 'next/navigation';

// Legacy demo-only route: real order creation now happens in /checkout.
export default function OrderReviewRedirect() {
  redirect('/checkout');
}
