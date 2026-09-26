import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentCustomer } from '@/services/customer-authorization.service';
import {
  CustomerNotificationService,
  type CustomerNotification,
} from '@/services/customer-notification.service';

function NotificationList({
  emptyMessage,
  items,
}: {
  emptyMessage: string;
  items: CustomerNotification[];
}) {
  return (
    <section className="mt-8" aria-live="polite">
      {items.length ? (
        <div className="divide-y border-y line">
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
        <p className="border-y line py-8 text-sm text-stone-600">{emptyMessage}</p>
      )}
    </section>
  );
}

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const customer = await getCurrentCustomer();
  if (!customer) redirect('/login?redirect=/account/notifications');

  const notifications = await new CustomerNotificationService().list(customer.id);
  const selectedTab = (await searchParams).tab === 'site' ? 'site' : 'personal';
  const orderNotifications = notifications.filter(
    (item) => item.kind === 'ORDER_MESSAGE',
  );
  const siteNotifications = notifications.filter(
    (item) => item.kind === 'ANNOUNCEMENT',
  );
  const isPersonal = selectedTab === 'personal';

  return (
    <main className="wrap py-14 md:py-20">
      <p className="eyebrow">Notifications</p>
      <h1 className="serif mt-4 text-5xl">お知らせ</h1>
      <nav
        aria-label="お知らせの種類"
        className="mt-10 flex gap-6 border-b line text-sm md:gap-9"
      >
        <Link
          href="/account/notifications?tab=personal"
          aria-current={isPersonal ? 'page' : undefined}
          className={
            isPersonal
              ? '-mb-px border-b-2 border-[#171412] pb-3 font-medium text-[#171412]'
              : 'pb-3 text-stone-500'
          }
        >
          ご注文・個別のお知らせ
        </Link>
        <Link
          href="/account/notifications?tab=site"
          aria-current={!isPersonal ? 'page' : undefined}
          className={
            !isPersonal
              ? '-mb-px border-b-2 border-[#171412] pb-3 font-medium text-[#171412]'
              : 'pb-3 text-stone-500'
          }
        >
          サイトからのお知らせ
        </Link>
      </nav>
      {isPersonal ? (
        <NotificationList
          emptyMessage="ご注文・個別のお知らせはありません。"
          items={orderNotifications}
        />
      ) : (
        <NotificationList
          emptyMessage="サイトからのお知らせはありません。"
          items={siteNotifications}
        />
      )}
    </main>
  );
}
