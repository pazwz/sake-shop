import { redirect } from 'next/navigation';

// Legacy demo-only route: successful orders use /orders/[orderNumber].
export default function OrderCompleteRedirect() {
  redirect('/checkout');
}
