import { NotFoundError } from '@/lib/errors';
import { CustomerNotificationRepository } from '@/repositories/customer-notification.repository';

export type CustomerNotification = {
  id: string; kind: 'ORDER_MESSAGE' | 'ANNOUNCEMENT'; title: string; preview: string;
  occurredAt: string; href: string; unread: boolean;
};

export class CustomerNotificationService {
  public constructor(private readonly repository = new CustomerNotificationRepository()) {}

  public async summary(customerId: string) {
    const [threads, announcements] = await Promise.all([
      this.repository.orderThreads(customerId), this.repository.activeAnnouncements(customerId, new Date()),
    ]);
    const unreadOrderThreads = threads.filter((thread) => {
      const latest = thread.messages[0]?.createdAt;
      return !!latest && (!thread.customerLastReadAt || latest > thread.customerLastReadAt);
    }).length;
    return { unreadOrderThreads, unreadAnnouncements: announcements.filter((item) => !item.reads[0]).length,
      unreadTotal: unreadOrderThreads + announcements.filter((item) => !item.reads[0]).length };
  }

  public async list(customerId: string): Promise<CustomerNotification[]> {
    const [threads, announcements] = await Promise.all([
      this.repository.orderThreads(customerId), this.repository.activeAnnouncements(customerId, new Date()),
    ]);
    const entries: CustomerNotification[] = [
      ...threads.flatMap((thread) => {
        const latest = thread.messages[0];
        if (!latest || !thread.orderNumber) return [];
        return [{ id: thread.id, kind: 'ORDER_MESSAGE' as const, title: `注文 ${thread.orderNumber} への返信`,
          preview: latest.body.slice(0, 120), occurredAt: latest.createdAt.toISOString(),
          href: `/account/orders/${encodeURIComponent(thread.orderNumber)}/messages`,
          unread: !thread.customerLastReadAt || latest.createdAt > thread.customerLastReadAt }];
      }),
      ...announcements.map((item) => ({ id: item.id, kind: 'ANNOUNCEMENT' as const,
        title: item.title, preview: item.body.slice(0, 120), occurredAt: item.publishedAt.toISOString(),
        href: `/account/notifications/${item.id}`, unread: !item.reads[0] })),
    ];
    return entries.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  }

  public async announcementForCustomer(id: string, customerId: string) {
    const announcement = await this.repository.activeAnnouncement(id, new Date());
    if (!announcement) throw new NotFoundError('お知らせが見つかりません。');
    return announcement;
  }
  public async markAnnouncementRead(id: string, customerId: string) {
    await this.announcementForCustomer(id, customerId);
    await this.repository.markAnnouncementRead(customerId, id);
  }
}
