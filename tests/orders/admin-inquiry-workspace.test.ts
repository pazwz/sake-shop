import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { ContactInquiryRepository } from '@/repositories/contact-inquiry.repository';
import { ContactInquiryService } from '@/services/contact-inquiry.service';
import { ProductService } from '@/services/product.service';
import {
  customerInquiryMessageValidator,
  inquiryReplyValidator,
} from '@/validators/contact-inquiry.validator';

test('admin read passes only displayed IDs and authenticated admin to repository', async () => {
  const calls: unknown[] = [];
  const service = new ContactInquiryService({
    markAdminRead: async (...args: unknown[]) => {
      calls.push(args);
      return { count: 1 };
    },
  } as never);
  assert.equal(typeof service.markAdminRead, 'function');
  await service.markAdminRead('thread', ['shown'], 'admin-a');
  assert.deepEqual(calls, [['thread', ['shown'], 'admin-a']]);
});

test('read markers acknowledge individual customer IDs, not timestamp/all-thread read', async () => {
  const writes: unknown[] = [];
  const repository = new ContactInquiryRepository({
    contactInquiryMessage: { findMany: async () => [{ id: 'shown' }] },
    adminInquiryMessageRead: {
      createMany: async (data: unknown) => {
        writes.push(data);
        return { count: 1 };
      },
    },
  } as never);
  assert.equal(typeof repository.markAdminRead, 'function');
  await repository.markAdminRead('thread', ['shown'], 'admin-a');
  const write = writes[0] as {
    data: Array<{ adminId: string; messageId: string }>;
    skipDuplicates: boolean;
  };
  assert.deepEqual(
    write.data.map(({ adminId, messageId }) => ({ adminId, messageId })),
    [{ adminId: 'admin-a', messageId: 'shown' }],
  );
  assert.equal(write.skipDuplicates, true);
});

test('wrong-thread or admin-message read IDs cannot create markers', async () => {
  let written = false;
  const repository = new ContactInquiryRepository({
    contactInquiryMessage: { findMany: async () => [] },
    adminInquiryMessageRead: {
      createMany: async () => {
        written = true;
      },
    },
  } as never);
  assert.equal(typeof repository.markAdminRead, 'function');
  await assert.rejects(() =>
    repository.markAdminRead('thread', ['foreign'], 'admin-a'),
  );
  assert.equal(written, false);
});

test('both message endpoints reject client-provided role and author IDs', () => {
  assert.equal(
    customerInquiryMessageValidator.safeParse({
      body: 'hello',
      senderType: 'ADMIN',
    }).success,
    false,
  );
  assert.equal(
    customerInquiryMessageValidator.safeParse({
      body: 'hello',
      authorCustomerId: 'other',
    }).success,
    false,
  );
  assert.equal(
    inquiryReplyValidator.safeParse({
      body: 'hello',
      idempotencyKey: '8cdd1f4d-25b1-4e7d-ae46-6ce3c5a47211',
      authorAdminId: 'other',
    }).success,
    false,
  );
});

test('root does not render storefront chrome and admin has independent navigation', async () => {
  const root = await readFile('app/layout.tsx', 'utf8');
  assert.equal(root.includes('<Header'), false);
  const admin = await readFile('app/admin/layout.tsx', 'utf8');
  assert.match(admin, /AdminWorkspace/);
});

test('repository inbox does priority sorting and paging in SQL', async () => {
  const queries: Array<{ sql: string; values: unknown[] }> = [];
  const repository = new ContactInquiryRepository({
    $queryRaw: async (sql: { sql: string; values: unknown[] }) => {
      queries.push(sql);
      return sql.sql.includes('COUNT(*)') ? [{ total: BigInt(0) }] : [];
    },
    $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
  } as never);
  await repository.list({ page: 2 }, 'admin-a');
  assert.match(queries[1].sql, /ORDER BY CASE/);
  assert.match(queries[1].sql, /LIMIT \? OFFSET \?/);
  assert.ok(queries[1].values.includes('admin-a'));
  assert.deepEqual(queries[1].values.slice(-2), [25, 25]);
});

test('inbox latest-message hydration has the same deterministic timestamp tie-break as SQL', async () => {
  let selection: { messages: { orderBy: unknown } } | undefined;
  const repository = new ContactInquiryRepository({
    $queryRaw: async (sql: { sql: string }) =>
      sql.sql.includes('COUNT(*)')
        ? [{ total: BigInt(1) }]
        : [{ id: 'thread', unread: true }],
    $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
    contactInquiry: {
      findMany: async ({
        select,
      }: {
        select: { messages: { orderBy: unknown } };
      }) => {
        selection = select;
        return [{ id: 'thread', createdAt: new Date(), messages: [] }];
      },
    },
  } as never);
  await repository.list({ page: 1 }, 'admin-a');
  assert.deepEqual(selection?.messages.orderBy, [
    { createdAt: 'desc' },
    { id: 'desc' },
  ]);
});

test('dashboard public product count uses count-only repository access', async () => {
  const service = new ProductService({ countPublic: async () => 419 } as never);
  assert.equal(typeof service.countPublic, 'function');
  assert.equal(await service.countPublic(), 419);
});
