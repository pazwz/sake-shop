import { notFound, redirect } from 'next/navigation';
import { CustomerOrderMessages } from '@/components/customer-order-messages';
import { NotFoundError } from '@/lib/errors';
import { getCurrentCustomer } from '@/services/customer-authorization.service';
import { ContactInquiryService } from '@/services/contact-inquiry.service';
import { CustomerOrderAccessService } from '@/services/customer-order-access.service';

export default async function OrderMessagesPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;
  const customer = await getCurrentCustomer();
  if (!customer)
    redirect(
      `/login?redirect=/account/orders/${encodeURIComponent(orderNumber)}/messages`,
    );
  let order;
  try {
    order = await new CustomerOrderAccessService(
      undefined,
      async () => customer,
    ).getOrderDetail(orderNumber);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
  const thread = await new ContactInquiryService().getForCustomer(
    order.id,
    customer.id,
  );
  return (
    <main className="wrap py-14 md:py-20">
      <p className="eyebrow">Order support</p>
      <h1 className="serif mt-4 text-4xl">注文についてのメッセージ</h1>
      <p className="mt-4 text-sm text-stone-600">
        注文番号：{order.orderNumber}
      </p>
      <CustomerOrderMessages orderId={order.id} thread={thread} />
    </main>
  );
}
