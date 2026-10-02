import { expect, test, type BrowserContext } from '@playwright/test';
import { ContactInquiryStatus, PrismaClient } from '@prisma/client';
import { ContactInquiryRepository } from '@/repositories/contact-inquiry.repository';
import { E2E_FIXTURES } from '@/config/e2e-fixtures';
import { getSafeE2EDatabaseEnvironment } from '@/config/e2e-database';
import { loginQaCustomer } from '@/e2e/helpers/customer';
import {
  mutationSuiteEnabled,
  requireNonProductionMutationEnvironment,
} from '@/e2e/helpers/environment';

test('admin workspace: dual-session authors, independent reads and concurrent reply', async ({
  page,
  browser,
}) => {
  test.skip(
    !mutationSuiteEnabled(),
    'Requires isolated mutation-enabled E2E fixtures.',
  );
  test.setTimeout(120_000);
  requireNonProductionMutationEnvironment();
  const safe = getSafeE2EDatabaseEnvironment();
  const database = new PrismaClient({ datasourceUrl: safe.databaseUrl });
  const orderNumber = 'E2E-ADMIN-WORKSPACE-001';
  const cleanupMessages = async () => {
    const rows = await database.contactInquiryMessage.findMany({
      where: {
        inquiry: {
          order: {
            orderNumber: { in: [orderNumber, E2E_FIXTURES.orderNumber] },
            customer: { email: E2E_FIXTURES.customer.email },
          },
        },
        body: { startsWith: 'E2E workspace customer' },
      },
      select: { id: true, emailOutboxId: true },
    });
    await database.$transaction([
      database.contactInquiryMessage.deleteMany({
        where: { id: { in: rows.map((row) => row.id) } },
      }),
      database.emailOutbox.deleteMany({
        where: {
          id: {
            in: rows.flatMap((row) =>
              row.emailOutboxId ? [row.emailOutboxId] : [],
            ),
          },
        },
      }),
    ]);
  };
  const second = await browser.newContext({
    baseURL: test.info().project.use.baseURL,
  });
  const loginAdmin = async (context: BrowserContext, secondary = false) => {
    const fixture = secondary
      ? E2E_FIXTURES.secondaryStaff
      : E2E_FIXTURES.staff;
    expect(
      (
        await context.request.post('/api/v1/admin/auth/login', {
          data: fixture,
        })
      ).status(),
    ).toBe(200);
  };
  try {
    await cleanupMessages();
    const customer = await database.customer.findUniqueOrThrow({
      where: { email: E2E_FIXTURES.customer.email },
    });
    await database.order.upsert({
      where: { orderNumber },
      update: {},
      create: {
        id: 'e2e-admin-workspace-order',
        orderNumber,
        customerId: customer.id,
        subtotal: 1000,
        shippingFee: 0,
        taxAmount: 0,
        totalAmount: 1000,
        paymentMethod: 'E2E_TEST',
        shippingAddressSnapshot: { city: 'E2E isolated test' },
      },
    });
    await loginQaCustomer(page);
    await loginAdmin(page.context());
    await loginAdmin(second, true);
    await page.goto(`/account/orders/${orderNumber}/messages`);
    await expect(
      page.getByRole('link', { name: '注文詳細へ戻る' }),
    ).toBeVisible();
    const text = `E2E workspace customer ${Date.now()}`;
    await page.getByLabel('メッセージ入力').fill(text);
    const sent = page.waitForResponse(
      (r) =>
        r.request().method() === 'POST' &&
        /\/my\/(orders\/[^/]+\/inquiries|inquiries\/[^/]+\/messages)$/.test(
          new URL(r.url()).pathname,
        ),
    );
    await page.getByRole('button', { name: '送信する' }).click();
    const response = await sent;
    expect(response.status()).toBe(201);
    const inquiryId = (await response.json()).data.inquiryId as string;
    const customerMessage =
      await database.contactInquiryMessage.findFirstOrThrow({
        where: { inquiryId, body: text },
      });
    expect(customerMessage.direction).toBe('CUSTOMER');
    expect(customerMessage.authorAdminId).toBeNull();
    expect(customerMessage.authorCustomerId).toBe(customer.id);

    const summary = async (context: BrowserContext) => {
      const result = await context.request.get(
        '/api/v1/admin/inquiries/unread-summary',
      );
      expect(result.status()).toBe(200);
      return (await result.json()).data as {
        unreadInquiryCount: number;
        recent: Array<{ id: string }>;
      };
    };
    expect(
      (await summary(page.context())).recent.some((i) => i.id === inquiryId),
    ).toBe(true);
    expect((await summary(second)).recent.some((i) => i.id === inquiryId)).toBe(
      true,
    );
    await page.goto('/admin/inquiries');
    await expect(page.getByTestId('admin-workspace')).toBeVisible();
    await expect(
      page.getByRole('navigation', { name: '管理画面ナビゲーション' }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'MY PAGE', exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('link', { name: 'BAG', exact: true }),
    ).toHaveCount(0);
    await expect(page.locator('tbody tr').first()).toHaveAttribute(
      'data-inquiry-id',
      inquiryId,
    );
    const read = page.waitForResponse(
      (r) =>
        r.request().method() === 'POST' &&
        r.url().endsWith(`/admin/inquiries/${inquiryId}/read`),
    );
    await page.goto(`/admin/inquiries/${inquiryId}`);
    expect((await read).status()).toBe(200);
    await expect(
      page.getByLabel('管理者メッセージ履歴').getByText(text),
    ).toBeVisible();
    expect(
      (await summary(page.context())).recent.some((i) => i.id === inquiryId),
    ).toBe(false);
    expect((await summary(second)).recent.some((i) => i.id === inquiryId)).toBe(
      true,
    );

    // Exact IDs protect even a new message with the SAME timestamp as the displayed message.
    await page.setViewportSize({ width: 1440, height: 900 });
    expect((await page.request.patch(`/api/v1/admin/inquiries/${inquiryId}/status`, { data: { status: 'CLOSED' } })).status()).toBe(200);
    await page.screenshot({
      path: test.info().outputPath('admin-desktop.png'),
    });
    await page.setViewportSize({ width: 375, height: 812 });
    await expect(page.getByText('管理メニュー', { exact: true })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({ path: test.info().outputPath('admin-mobile.png') });
    await page.setViewportSize({ width: 1440, height: 900 });
    const customerReply = await page.request.post(
      `/api/v1/my/inquiries/${inquiryId}/messages`,
      { data: { body: `${text} concurrent` } },
    );
    expect(customerReply.status()).toBe(201);
    expect((await database.contactInquiry.findUniqueOrThrow({ where: { id: inquiryId } })).status).toBe('IN_PROGRESS');
    const concurrent = await database.contactInquiryMessage.findFirstOrThrow({
      where: { inquiryId, body: `${text} concurrent` },
    });
    await database.contactInquiryMessage.update({
      where: { id: concurrent.id },
      data: { createdAt: customerMessage.createdAt },
    });
    expect(
      (
        await page.request.post(`/api/v1/admin/inquiries/${inquiryId}/read`, {
          data: { messageIds: [customerMessage.id] },
        })
      ).status(),
    ).toBe(200);
    expect(
      (await summary(page.context())).recent.some((i) => i.id === inquiryId),
    ).toBe(true);
    expect(
      (
        await page.request.post(`/api/v1/my/inquiries/${inquiryId}/messages`, {
          data: { body: 'spoofed', senderType: 'ADMIN' },
        })
      ).status(),
    ).toBe(422);

    const adminText = `${text} admin`;
    const adminReplyKey = crypto.randomUUID();
    const adminReply = await page.request.post(
      `/api/v1/admin/inquiries/${inquiryId}/reply`,
      { data: { body: adminText, idempotencyKey: adminReplyKey } },
    );
    expect(adminReply.status()).toBe(201);
    const repeatedReply = await page.request.post(
      `/api/v1/admin/inquiries/${inquiryId}/reply`,
      { data: { body: adminText, idempotencyKey: adminReplyKey } },
    );
    expect(repeatedReply.status()).toBe(201);
    expect((await repeatedReply.json()).data.duplicate).toBe(true);
    expect(await database.contactInquiryMessage.count({ where: { inquiryId, body: adminText } })).toBe(1);
    const adminMessage = await database.contactInquiryMessage.findFirstOrThrow({
      where: { inquiryId, body: adminText },
      include: { authorAdmin: true },
    });
    expect(adminMessage.direction).toBe('ADMIN');
    expect(adminMessage.authorAdmin?.username).toBe(
      E2E_FIXTURES.staff.username,
    );
    expect(adminMessage.authorAdminId).toBe(adminMessage.authorAdmin?.id);
    expect(adminMessage.authorCustomerId).toBeNull();
    expect(
      (
        await page.request.post(`/api/v1/admin/inquiries/${inquiryId}/read`, {
          data: { messageIds: [adminMessage.id] },
        })
      ).status(),
    ).toBe(422);
    const reloadedRead = page.waitForResponse(
      (r) =>
        r.request().method() === 'POST' &&
        r.url().endsWith(`/admin/inquiries/${inquiryId}/read`),
    );
    await page.reload();
    expect((await reloadedRead).status()).toBe(200);
    await expect(
      page
        .locator('[data-message-direction="ADMIN"]')
        .filter({ hasText: adminText }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: '管理画面トップへ' }),
    ).toBeVisible();
    expect(
      (await summary(page.context())).recent.some((i) => i.id === inquiryId),
    ).toBe(false);
    expect((await summary(second)).recent.some((i) => i.id === inquiryId)).toBe(
      true,
    );
    expect(
      (
        await second.request.get('/api/v1/customer/notifications/summary')
      ).status(),
    ).toBe(401);
    await page.request.post('/api/v1/admin/auth/logout');
    expect(
      (
        await page.request.get('/api/v1/admin/inquiries/unread-summary')
      ).status(),
    ).toBe(401);
    expect(
      (
        await page.request.get('/api/v1/customer/notifications/summary')
      ).status(),
    ).toBe(200);
  } finally {
    await second.close();
    try { await cleanupMessages(); } finally { await database.$disconnect(); }
  }
});

test('inbox priority, filters and pagination are applied by the real isolated database', async () => {
  test.skip(!mutationSuiteEnabled(), 'Requires isolated E2E database.');
  test.setTimeout(120_000);
  requireNonProductionMutationEnvironment();
  const safe = getSafeE2EDatabaseEnvironment();
  const database = new PrismaClient({ datasourceUrl: safe.databaseUrl });
  const ids = Array.from(
    { length: 32 },
    (_, i) => `e2e-inbox-ranking-${String(i).padStart(2, '0')}`,
  );
  const cleanup = async () => {
    await database.$transaction([
      database.adminInquiryMessageRead.deleteMany({
        where: { message: { inquiryId: { in: ids } } },
      }),
      database.contactInquiryMessage.deleteMany({
        where: { inquiryId: { in: ids } },
      }),
      database.contactInquiry.deleteMany({
        where: { id: { in: ids }, publicId: { startsWith: 'E2E-RANK-' } },
      }),
    ]);
  };
  try {
    const admin = await database.adminUser.findUniqueOrThrow({
      where: { username: E2E_FIXTURES.staff.username },
    });
    await cleanup();
    await database.contactInquiry.createMany({
      data: ids.map((id, i) => ({
        id,
        submissionId: id,
        publicId: `E2E-RANK-${i}`,
        topic: 'E2E_INBOX_RANK',
        email: 'e2e-ranking@example.test',
        message: 'E2E ranking only',
        status:
          i === 0
            ? ContactInquiryStatus.CLOSED
            : i === 2 || i === 3
              ? ContactInquiryStatus.IN_PROGRESS
              : ContactInquiryStatus.NEW,
      })),
    });
    await database.contactInquiryMessage.createMany({
      data: ids.map((id, i) => ({
        id: `${id}-customer`,
        inquiryId: id,
        direction: 'CUSTOMER',
        fromEmail: 'e2e-ranking@example.test',
        toEmail: '',
        subject: 'E2E rank',
        body: `rank ${i}`,
        createdAt: new Date(
          Date.UTC(2026, 0, 1, 0, i === 0 ? 1000 : i === 2 ? 99 : i),
        ),
      })),
    });
    await database.$transaction([
      database.contactInquiryMessage.create({
        data: {
          id: `${ids[3]}-admin`,
          inquiryId: ids[3],
          direction: 'ADMIN',
          authorAdminId: admin.id,
          fromEmail: '',
          toEmail: 'e2e-ranking@example.test',
          subject: 'E2E rank admin',
          body: 'reply',
          createdAt: new Date(Date.UTC(2026, 0, 1, 0, 100)),
        },
      }),
      database.adminInquiryMessageRead.create({
        data: { adminId: admin.id, messageId: `${ids[2]}-customer` },
      }),
    ]);
    const repository = new ContactInquiryRepository(database);
    const first = await repository.list({ q: 'E2E-RANK-', page: 1 }, admin.id);
    const second = await repository.list({ q: 'E2E-RANK-', page: 2 }, admin.id);
    expect(first.pagination.total).toBe(32);
    expect(first.items.map((i) => i.id)).toEqual(ids.slice(7).reverse());
    expect(second.items.map((i) => i.id)).toEqual([
      ids[6],
      ids[5],
      ids[4],
      ids[1],
      ids[2],
      ids[3],
      ids[0],
    ]);
    expect(
      (
        await repository.list(
          { q: 'E2E-RANK-', page: 1, status: ContactInquiryStatus.CLOSED },
          admin.id,
        )
      ).items.map((i) => i.id),
    ).toEqual([ids[0]]);
    expect(second.items.find((i) => i.id === ids[3])?.lastDirection).toBe(
      'ADMIN',
    );
  } finally {
    await cleanup();
    await database.$disconnect();
  }
});
