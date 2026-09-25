import { notFound, redirect } from 'next/navigation';
import { CustomerAnnouncementDetail } from '@/components/customer-announcement-detail';
import { NotFoundError } from '@/lib/errors';
import { getCurrentCustomer } from '@/services/customer-authorization.service';
import { CustomerNotificationService } from '@/services/customer-notification.service';
export default async function AnnouncementPage({ params }: { params: Promise<{ id: string }> }) {
  const customer = await getCurrentCustomer();
  if (!customer) redirect('/login?redirect=/account/notifications');
  const announcement = await new CustomerNotificationService().announcementForCustomer((await params).id, customer.id).catch((error: unknown) => {
    if (error instanceof NotFoundError) return null;
    throw error;
  });
  if (!announcement) notFound();
  return <main className="wrap py-14 md:py-20"><CustomerAnnouncementDetail id={announcement.id} /><p className="eyebrow">Information</p><h1 className="serif mt-4 text-4xl">{announcement.title}</h1><time className="mt-5 block text-sm text-stone-500">{announcement.publishedAt.toLocaleDateString('ja-JP')}</time><p className="mt-8 whitespace-pre-wrap leading-8">{announcement.body}</p></main>;
}
