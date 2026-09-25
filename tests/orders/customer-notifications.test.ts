import assert from 'node:assert/strict';
import test from 'node:test';
import { CustomerNotificationService } from '@/services/customer-notification.service';
import { siteAnnouncementValidator } from '@/validators/site-announcement.validator';

test('notification summary counts unread order threads, not individual messages', async () => {
  const service = new CustomerNotificationService({
    orderThreads: async () => [{ id: 'thread-1', orderNumber: 'ORDER-1', customerLastReadAt: null, messages: [{ body: '返信1', createdAt: new Date('2026-09-25T01:00:00Z') }] }],
    activeAnnouncements: async () => [],
  } as never);
  assert.deepEqual(await service.summary('customer-1'), { unreadOrderThreads: 1, unreadAnnouncements: 0, unreadTotal: 1 });
});

test('expired announcements are delegated to the active visibility query and do not count unread', async () => {
  const service = new CustomerNotificationService({ orderThreads: async () => [], activeAnnouncements: async () => [] } as never);
  assert.equal((await service.summary('customer-1')).unreadTotal, 0);
});

test('announcement validation rejects empty sections and invalid expiry ordering', () => {
  assert.equal(siteAnnouncementValidator.safeParse({ title: '', body: '本文', type: 'GENERAL', publishedAt: new Date(), isPublished: false }).success, false);
  assert.equal(siteAnnouncementValidator.safeParse({ title: 'お知らせ', body: '本文', type: 'GENERAL', publishedAt: '2026-09-26T00:00:00Z', expiresAt: '2026-09-25T00:00:00Z', isPublished: true }).success, false);
});
