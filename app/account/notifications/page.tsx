import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentCustomer } from '@/services/customer-authorization.service';
import {
  CustomerNotificationService,
  type CustomerNotification,
} from '@/services/customer-notification.service';

function NotificationGroup({
  title,
  description,
  emptyMessage,
  items,
}: {
  title: string;
  description: string;
  emptyMessage: string;
  items: CustomerNotification[];
}) {
  return (
    <section className="mt-12 first:mt-10" aria-label={title}>
      <div className="border-b border-[#171412] pb-4">
        <h2 className="serif text-2xl">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-stone-600">{description}</p>
      </div>
      {items.length ? (
        <div className="divide-y border-b line">
          {items.map((item) => (
            <Link key={item.id} href={item.href} className="block py-5">
              <div className="flex gap-3">
                <span
                  aria-label={item.unread ? '未読' : '既読'}
                  className={
                    item.unread
                      ? 'mt-2 h-2 w-2 shrink-0 rounded-full bg-[#6d2227]'
                      : 'mt-2 h-2 w-2 shrink-0'
                  }
                />
                <div>
                  <p className="text-xs text-stone-500">
                    {item.kind === 'ORDER_MESSAGE' ? '注文メッセージ' : 'お知らせ'}
                    {'　'}
                    {new Date(item.occurredAt).toLocaleDateString('ja-JP')}
                  </p>
                  <p className="mt-1 text-sm font-medium">{item.title}</p>
                  <p className="mt-2 text-sm text-stone-600">{item.preview}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="border-b line py-8 text-sm text-stone-600">{emptyMessage}</p>
      )}
    </section>
  );
}

export default async function NotificationsPage() {
  const customer = await getCurrentCustomer();
  if (!customer) redirect('/login?redirect=/account/notifications');

  const notifications = await new CustomerNotificationService().list(customer.id);
  const orderNotifications = notifications.filter(
    (item) => item.kind === 'ORDER_MESSAGE',
  );
  const siteNotifications = notifications.filter(
    (item) => item.kind === 'ANNOUNCEMENT',
  );

  return (
    <main className="wrap py-14 md:py-20">
      <p className="eyebrow">Notifications</p>
      <h1 className="serif mt-4 text-5xl">お知らせ</h1>
      <NotificationGroup
        title="ご注文・個別のお知らせ"
        description="ご注文に関するメッセージや、お客様への個別のお知らせをご確認いただけます。"
        emptyMessage="ご注文・個別のお知らせはありません。"
        items={orderNotifications}
      />
      <NotificationGroup
        title="サイトからのお知らせ"
        description="LINXASからのお知らせや、サービスに関するご案内です。"
        emptyMessage="サイトからのお知らせはありません。"
        items={siteNotifications}
      />
    </main>
  );
}
