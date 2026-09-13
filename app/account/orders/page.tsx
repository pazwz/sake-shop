import Link from 'next/link';
import { redirect } from 'next/navigation';
import { formatPrice } from '@/lib/products';
import { getCurrentCustomer } from '@/services/customer-authorization.service';
import { CustomerOrderAccessService } from '@/services/customer-order-access.service';

export default async function AccountOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const customer = await getCurrentCustomer();
  if (!customer) redirect('/login?redirect=/account/orders');
  const requested = Number((await searchParams).page ?? '1');
  const orders = await new CustomerOrderAccessService(
    undefined,
    async () => customer,
  ).getOrderPage(Number.isFinite(requested) ? requested : 1);
  return (
    <main className="wrap py-14 md:py-20">
      <p className="eyebrow">Order history</p>
      <h1 className="serif mt-4 text-5xl">ご注文履歴</h1>
      {orders.total === 0 ? (
        <p className="mt-10 border-y line py-10 text-sm text-stone-600">
          ご注文履歴はまだありません。
        </p>
      ) : (
        <div className="mt-10 space-y-4">
          {orders.items.map((order) => (
            <Link
              key={order.orderNumber}
              href={`/account/orders/${encodeURIComponent(order.orderNumber)}`}
              className="grid gap-3 border p-5 text-sm sm:grid-cols-4"
            >
              <span>{order.orderNumber}</span>
              <span>
                {new Date(order.createdAt).toLocaleDateString('ja-JP')}
              </span>
              <span>{order.status}</span>
              <span className="sm:text-right">
                {formatPrice(order.totalAmount)}
              </span>
            </Link>
          ))}
        </div>
      )}
      <nav className="mt-8 flex gap-4 text-sm">
        {orders.page > 1 ? (
          <Link href={`/account/orders?page=${orders.page - 1}`}>前へ</Link>
        ) : null}
        {orders.page < orders.totalPages ? (
          <Link href={`/account/orders?page=${orders.page + 1}`}>次へ</Link>
        ) : null}
      </nav>
    </main>
  );
}
