import assert from 'node:assert/strict';
import test from 'node:test';
import { InventoryReservationStatus, OrderStatus, PaymentProvider, PaymentStatus, Prisma } from '@prisma/client';
import { InventoryReservationRepository } from '@/repositories/inventory-reservation.repository';
import { PaymentRepository } from '@/repositories/payment.repository';

type Hold = { status: InventoryReservationStatus; expiresAt: Date | null };
// Small test database interpreter for the reservation predicates emitted by the real repositories.
function matches(row: Hold, where: Prisma.InventoryReservationWhereInput): boolean {
  const parts = (value: Prisma.InventoryReservationWhereInput | Prisma.InventoryReservationWhereInput[]) =>
    Array.isArray(value) ? value : [value];
  if (where.AND && !parts(where.AND).every((w) => matches(row, w))) return false;
  if (where.OR && !where.OR.some((w) => matches(row, w))) return false;
  if (where.NOT && parts(where.NOT).some((w) => matches(row, w))) return false;
  if (typeof where.status === 'string' && row.status !== where.status) return false;
  if (where.status && typeof where.status === 'object' && row.status === where.status.not) return false;
  if (where.expiresAt === null && row.expiresAt !== null) return false;
  const filter = where.expiresAt;
  if (filter && typeof filter === 'object' && !(filter instanceof Date)) {
    if (filter.not === null && row.expiresAt === null) return false;
    if (filter.gt instanceof Date && (!row.expiresAt || row.expiresAt <= filter.gt)) return false;
    if (filter.lt instanceof Date && (!row.expiresAt || row.expiresAt >= filter.lt)) return false;
    if (filter.lte instanceof Date && (!row.expiresAt || row.expiresAt > filter.lte)) return false;
  }
  return true;
}

test('both public and locked checkout aggregation ignore elapsed holds before cleanup, preserving paid NULL holds', async (t) => {
  const now = new Date('2026-10-15T00:00:00Z');
  t.mock.timers.enable({ apis: ['Date'], now: now.getTime() });
  const rows: Hold[] = [
    { status: 'ACTIVE', expiresAt: null },
    { status: 'ACTIVE', expiresAt: new Date(now.getTime() + 1) },
    { status: 'ACTIVE', expiresAt: now },
    { status: 'ACTIVE', expiresAt: new Date(now.getTime() - 1) },
    { status: 'RELEASED', expiresAt: null },
  ];
  const delegate = {
    groupBy: async ({ where }: { where: Prisma.InventoryReservationWhereInput }) =>
      [{ productId: 'p', _sum: { quantity: rows.filter((r) => matches(r, where)).length } }],
    updateMany: async ({ where, data }: { where: Prisma.InventoryReservationWhereInput; data: Partial<Hold> }) => {
      const found = rows.filter((r) => matches(r, where));
      found.forEach((r) => Object.assign(r, data));
      return { count: found.length };
    },
  };
  const repository = new InventoryReservationRepository({
    inventoryReservation: delegate,
    $transaction: async (operation: (tx: unknown) => Promise<unknown>) =>
      operation({ inventoryReservation: delegate, $queryRaw: async () => [] }),
  } as never);
  assert.equal((await repository.getActiveReservedQuantities(['p'])).get('p'), 2);
  await repository.withLockedProducts(['p'], async (tx) => {
    assert.equal((await tx.getActiveReservedQuantities(['p'])).get('p'), 2);
  });
  assert.equal((await repository.expireDue(now)).count, 2);
  assert.equal((await repository.expireDue(now)).count, 0);
  assert.equal((await repository.getActiveReservedQuantities(['p'])).get('p'), 2);
  assert.equal(rows[0].status, 'ACTIVE');
});

for (const [label, offset, expected] of [
  ['future', 1, 'SUCCEEDED'],
  ['paid NULL', null, 'SUCCEEDED'],
  ['equal', 0, 'REQUIRES_REVIEW'],
  ['expired', -1, 'REQUIRES_REVIEW'],
] as const) {
  test(`payment confirmation: ${label} expiry -> ${expected}, never revive elapsed stock`, async (t) => {
    const now = new Date('2026-10-15T00:00:00Z');
    t.mock.timers.enable({ apis: ['Date'], now: now.getTime() });
    const hold: Hold = { status: 'ACTIVE', expiresAt: offset === null ? null : new Date(now.getTime() + offset) };
    let status: PaymentStatus = 'PENDING';
    let holdWrites = 0;
    const payment = () => ({ id: 'pay', orderId: 'order', status });
    const tx = {
      $queryRaw: async () => [],
      paymentWebhookEvent: { create: async () => ({ id: 'evt' }), update: async () => ({}) },
      payment: {
        findUniqueOrThrow: async () => payment(),
        updateMany: async ({ where, data }: { where: { status: PaymentStatus }; data: { status: PaymentStatus } }) => {
          if (status !== where.status) return { count: 0 };
          status = data.status;
          return { count: 1 };
        },
      },
      order: { findUniqueOrThrow: async () => ({ status: OrderStatus.PENDING, customer: { email: 'qa@example.test' } }), update: async () => ({}) },
      inventoryReservation: {
        findMany: async () => [{ productId: 'p' }],
        count: async ({ where }: { where: Prisma.InventoryReservationWhereInput }) => matches(hold, where) ? 1 : 0,
        updateMany: async () => { holdWrites++; hold.expiresAt = null; return { count: 1 }; },
      },
      syncLog: { create: async () => ({}) },
      emailOutbox: { upsert: async () => ({}) },
    };
    const repository = new PaymentRepository({ $transaction: async (fn: (client: unknown) => Promise<unknown>) => fn(tx) } as never);
    const input = { provider: PaymentProvider.STERA, eventId: 'evt', eventType: 'payment.success', paymentId: 'pay', expectedStatus: PaymentStatus.PENDING, nextStatus: PaymentStatus.SUCCEEDED, providerPaymentId: 'provider', amount: 1, currency: 'JPY' as const, outcome: 'SUCCEEDED' as const, reservationTransition: 'HOLD' as const };
    const result = await repository.processWebhook(input);
    assert.equal(result.payment.status, expected);
    assert.equal(holdWrites, expected === 'SUCCEEDED' ? 1 : 0);
    if (expected === 'REQUIRES_REVIEW') assert.equal(hold.expiresAt?.getTime(), now.getTime() + Number(offset));
  });
}
