import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentCustomer } from '@/services/customer-authorization.service';
import { CustomerNotificationService } from '@/services/customer-notification.service';
export default async function NotificationsPage() {
  const customer = await getCurrentCustomer(); if (!customer) redirect('/login?redirect=/account/notifications');
  const notifications = await new CustomerNotificationService().list(customer.id);
  return <main className="wrap py-14 md:py-20"><p className="eyebrow">Notifications</p><h1 className="serif mt-4 text-5xl">お知らせ</h1>
    {notifications.length ? <div className="mt-10 divide-y border-y line">{notifications.map((item) => <Link key={`${item.kind}-${item.id}`} href={item.href} className="block py-5"><div className="flex gap-3"><span className={item.unread ? 'mt-2 h-2 w-2 shrink-0 rounded-full bg-[#6d2227]' : 'mt-2 h-2 w-2 shrink-0'} /><div><p className="text-xs text-stone-500">{item.kind === 'ORDER_MESSAGE' ? '注文メッセージ' : 'お知らせ'}　{new Date(item.occurredAt).toLocaleDateString('ja-JP')}</p><p className="mt-1 text-sm font-medium">{item.title}</p><p className="mt-2 text-sm text-stone-600">{item.preview}</p></div></div></Link>)}</div> : <p className="mt-10 border-y line py-10 text-sm text-stone-600">新しいお知らせはありません。</p>}</main>;
}
