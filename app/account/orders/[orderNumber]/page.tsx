import { notFound, redirect } from 'next/navigation';
import { CustomerOrderDetail } from '@/components/customer-order-detail';
import { NotFoundError } from '@/lib/errors';
import { getCurrentCustomer } from '@/services/customer-authorization.service';
import { CustomerOrderAccessService } from '@/services/customer-order-access.service';

const loadOrder = async (orderNumber: string, customer: { id: string }) => {
  try {
    return await new CustomerOrderAccessService(
      undefined,
      async () => customer,
    ).getOrderDetail(orderNumber);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
};

export default async function AccountOrderPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;
  const customer = await getCurrentCustomer();
  if (!customer)
    redirect(
      `/login?redirect=/account/orders/${encodeURIComponent(orderNumber)}`,
    );
  const order = await loadOrder(orderNumber, customer);
  return <CustomerOrderDetail order={order} />;
}
