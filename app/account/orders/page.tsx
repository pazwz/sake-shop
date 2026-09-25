/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { formatPrice } from '@/lib/products';
import { getCurrentCustomer } from '@/services/customer-authorization.service';
import { CustomerOrderAccessService } from '@/services/customer-order-access.service';
import { CUSTOMER_ORDER_STATUS_LABELS, CUSTOMER_SHIPMENT_CARRIER_LABELS, CUSTOMER_SHIPMENT_STATUS_LABELS } from '@/config/customer-order';

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
        <div className="mt-10 space-y-5">
          {orders.items.map((order) => (
            <article key={order.orderNumber} className="border line bg-white p-5 md:p-7">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs text-stone-500">{new Date(order.createdAt).toLocaleDateString('ja-JP')}　注文番号：{order.orderNumber}</p>
                  <p className="mt-2 text-sm font-medium text-[#6d2227]">{CUSTOMER_ORDER_STATUS_LABELS[order.status]}</p>
                </div>
                <p className="text-sm font-medium">{formatPrice(order.totalAmount)}</p>
              </div>
              <div className="mt-5 space-y-3">
                {order.items.slice(0, 3).map((item, index) => (
                  <div className="flex items-center gap-3 text-sm" key={`${item.productName}-${index}`}>
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center bg-white">
                      {item.imageUrl ? <img src={item.imageUrl} alt={item.imageAlt ?? item.productName} className="h-full w-full object-contain" /> : <span className="text-[10px] text-stone-400">画像準備中</span>}
                    </div>
                    <span className="min-w-0 flex-1">{item.productName}</span><span>× {item.quantity}</span>
                  </div>
                ))}
                {order.items.length > 3 ? <p className="text-xs text-stone-500">ほか{order.items.length - 3}点</p> : null}
              </div>
              {order.shipment ? <p className="mt-5 text-xs text-stone-600">配送状況：{CUSTOMER_SHIPMENT_STATUS_LABELS[order.shipment.status]}{order.shipment.carrier ? `／${CUSTOMER_SHIPMENT_CARRIER_LABELS[order.shipment.carrier] ?? order.shipment.carrier}` : ''}{order.shipment.trackingNumber ? `（お問い合わせ番号：${order.shipment.trackingNumber}）` : ''}</p> : null}
              <div className="mt-6 flex flex-wrap gap-4 text-sm underline">
                <Link href={`/account/orders/${encodeURIComponent(order.orderNumber)}`}>注文詳細を見る</Link>
                <Link href={`/account/orders/${encodeURIComponent(order.orderNumber)}/messages`}>{order.hasUnreadMessage ? 'メッセージを確認（未読）' : 'この注文について問い合わせる'}</Link>
              </div>
            </article>
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
