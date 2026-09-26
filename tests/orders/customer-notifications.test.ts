import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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

test('customer notification and order-message pages retain distinct notification groups and conversation semantics', async () => {
  const [notificationsPage, messagesPage, orderPage, orderMessagesPage] = await Promise.all([
    readFile(`${process.cwd()}/app/account/notifications/page.tsx`, 'utf8'),
    readFile(`${process.cwd()}/components/customer-order-messages.tsx`, 'utf8'),
    readFile(`${process.cwd()}/app/account/orders/[orderNumber]/page.tsx`, 'utf8'),
    readFile(
      `${process.cwd()}/app/account/orders/[orderNumber]/messages/page.tsx`,
      'utf8',
    ),
  ]);

  assert.match(notificationsPage, /ご注文・個別のお知らせ/);
  assert.match(notificationsPage, /サイトからのお知らせ/);
  assert.match(notificationsPage, /item\.kind === 'ORDER_MESSAGE'/);
  assert.match(messagesPage, /カスタマーセンター/);
  assert.match(messagesPage, /お客様/);
  assert.match(messagesPage, /data-message-direction/);
  assert.match(orderPage, /注文履歴へ戻る/);
  assert.match(orderMessagesPage, /注文詳細へ戻る/);
});
