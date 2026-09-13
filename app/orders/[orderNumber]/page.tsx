import { redirect } from 'next/navigation';

export default async function LegacyCustomerOrderPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;
  redirect(`/account/orders/${encodeURIComponent(orderNumber)}`);
}
