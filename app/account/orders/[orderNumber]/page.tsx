import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { NotFoundError } from '@/lib/errors';
import { formatPrice } from '@/lib/products';
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
  return (
    <main className="wrap py-14 md:py-20">
      <Link href="/account/orders" className="text-sm underline underline-offset-4">
        注文履歴へ戻る
      </Link>
      <p className="eyebrow">Order detail</p>
      <h1 className="serif mt-4 text-4xl">{order.orderNumber}</h1>
      <div className="mt-8 flex flex-wrap gap-6 text-sm">
        <span>{new Date(order.createdAt).toLocaleDateString('ja-JP')}</span>
        <span>{order.status}</span>
        <span>{order.paymentStatus}</span>
      </div>
      <div className="mt-8 border-y line py-5">
        {order.items.map((item) => (
          <div
            key={`${item.productId}:${item.productCode}`}
            className="flex justify-between gap-4 py-2 text-sm"
          >
            <span>
              {item.productName} × {item.quantity}
            </span>
            <span>{formatPrice(item.subtotal)}</span>
          </div>
        ))}
      </div>
      <p className="mt-6 text-right text-lg">
        合計 {formatPrice(order.totalAmount)}
      </p>
      {order.shipment ? (
        <p className="mt-5 text-sm">
          配送状況: {order.shipment.status}
          {order.shipment.trackingNumber
            ? ` / ${order.shipment.trackingNumber}`
            : ''}
        </p>
      ) : null}
      <Link
        href={`/account/orders/${encodeURIComponent(order.orderNumber)}/messages`}
        className="btn btn-outline mt-8 inline-flex"
      >
        この注文について問い合わせる
      </Link>
    </main>
  );
}
