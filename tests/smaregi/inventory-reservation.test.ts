import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma } from '@prisma/client';
import { InventoryReservationRepository } from '@/repositories/inventory-reservation.repository';
import { InventoryReservationService } from '@/services/inventory-reservation.service';
import { projectApprovedInventory } from '@/services/inventory-projection.service';
import { OrderService } from '@/services/order.service';
import type { OrderInput } from '@/validators/order.validator';

type FakeProduct = {
  id: string;
  productCode: string;
  name: string;
  price: Prisma.Decimal;
  taxRate: Prisma.Decimal;
  isActive: boolean;
  isEcAvailable: boolean;
  inventoryMirrors: Array<{
    smaregiStoreId: string;
    quantity: number;
  }>;
};

const product = (
  id: string,
  quantities: [number, number, number, number],
): FakeProduct => ({
  id,
  productCode: `CODE-${id}`,
  name: `Product ${id}`,
  price: new Prisma.Decimal(1000),
  taxRate: new Prisma.Decimal(10),
  isActive: true,
  isEcAvailable: true,
  inventoryMirrors: ['1', '2', '3', '6'].map((smaregiStoreId, index) => ({
    smaregiStoreId,
    quantity: quantities[index],
  })),
});

const input = (items: OrderInput['items']): OrderInput => ({
  items,
  customer: { email: 'buyer@example.com', name: 'Buyer', phone: '09000000000' },
  address: {
    postalCode: '810-0001',
    prefecture: '福岡県',
    city: '福岡市',
    addressLine1: '1-1',
    recipientName: 'Buyer',
    phone: '09000000000',
  },
  ageConfirmed: true,
  shippingMethod: 'standard',
  paymentMethod: 'card',
});

class FakeLockedReservationRepository {
  public readonly active = new Map<string, number>();
  public readonly orders: Array<{
    id: string;
    items: Array<{
      productId: string;
      quantity: number;
      requiresTransfer: boolean;
    }>;
  }> = [];
  private queue = Promise.resolve();

  public constructor(private readonly products: FakeProduct[]) {}

  public async withLockedProducts<T>(
    _productIds: string[],
    operation: (transaction: {
      findProducts(productIds: string[]): Promise<FakeProduct[]>;
      getActiveReservedQuantities(
        productIds: string[],
      ): Promise<Map<string, number>>;
      upsertCustomer(): Promise<{ id: string }>;
      createOrderWithReservations(order: {
        id: string;
        items: Array<{
          productId: string;
          quantity: number;
          requiresTransfer: boolean;
        }>;
      }): Promise<unknown>;
    }) => Promise<T>,
  ) {
    let release: () => void = () => {};
    const previous = this.queue;
    this.queue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    const activeSnapshot = new Map(this.active);
    const ordersLength = this.orders.length;
    try {
      return await operation({
        findProducts: async (productIds) =>
          this.products.filter((item) => productIds.includes(item.id)),
        getActiveReservedQuantities: async (productIds) =>
          new Map(
            productIds.map((productId) => [
              productId,
              this.active.get(productId) ?? 0,
            ]),
          ),
        upsertCustomer: async () => ({ id: 'customer-1' }),
        createOrderWithReservations: async (order) => {
          await new Promise((resolve) => setTimeout(resolve, 5));
          for (const item of order.items)
            this.active.set(
              item.productId,
              (this.active.get(item.productId) ?? 0) + item.quantity,
            );
          this.orders.push(order);
          return order;
        },
      });
    } catch (error) {
      this.active.clear();
      for (const [productId, quantity] of activeSnapshot)
        this.active.set(productId, quantity);
      this.orders.splice(ordersLength);
      throw error;
    } finally {
      release();
    }
  }
}

const service = (
  products: FakeProduct[],
  active: Array<[string, number]> = [],
) => {
  const repository = new FakeLockedReservationRepository(products);
  active.forEach(([productId, quantity]) =>
    repository.active.set(productId, quantity),
  );
  return {
    repository,
    service: new OrderService({} as never, repository as never),
  };
};

test('reserves product-level quantity and rejects insufficient aggregate inventory', async () => {
  const availableProduct = product('a', [3, 2, 0, 0]);
  const successful = service([availableProduct]);
  await successful.service.create(input([{ productId: 'a', quantity: 2 }]));
  assert.equal(successful.repository.active.get('a'), 2);
  assert.equal(
    projectApprovedInventory(
      availableProduct.inventoryMirrors,
      successful.repository.active.get('a') ?? 0,
    ).availableQuantity,
    3,
  );

  const insufficient = service([product('a', [3, 2, 0, 0])], [['a', 4]]);
  await assert.rejects(
    insufficient.service.create(input([{ productId: 'a', quantity: 2 }])),
    { code: 'INSUFFICIENT_INVENTORY' },
  );
  assert.equal(insufficient.repository.active.get('a'), 4);
});

test('captures conservative requiresTransfer snapshot', async () => {
  const direct = service([product('a', [3, 2, 0, 0])]);
  const directOrder = (await direct.service.create(
    input([{ productId: 'a', quantity: 2 }]),
  )) as { items: Array<{ requiresTransfer: boolean }> };
  assert.equal(directOrder.items[0].requiresTransfer, false);

  const transfer = service([product('a', [1, 4, 0, 0])]);
  const transferOrder = (await transfer.service.create(
    input([{ productId: 'a', quantity: 2 }]),
  )) as { items: Array<{ requiresTransfer: boolean }> };
  assert.equal(transferOrder.items[0].requiresTransfer, true);

  const existing = service([product('a', [1, 4, 0, 0])], [['a', 1]]);
  const existingOrder = (await existing.service.create(
    input([{ productId: 'a', quantity: 1 }]),
  )) as { items: Array<{ requiresTransfer: boolean }> };
  assert.equal(existingOrder.items[0].requiresTransfer, true);
});

test('serializes concurrent orders competing for the last item', async () => {
  const concurrent = service([product('a', [1, 0, 0, 0])]);
  const results = await Promise.allSettled([
    concurrent.service.create(input([{ productId: 'a', quantity: 1 }])),
    concurrent.service.create(input([{ productId: 'a', quantity: 1 }])),
  ]);
  assert.equal(
    results.filter((result) => result.status === 'fulfilled').length,
    1,
  );
  assert.equal(
    results.filter((result) => result.status === 'rejected').length,
    1,
  );
  assert.equal(concurrent.repository.active.get('a'), 1);
});

test('rolls back the whole multi-product order when one item is insufficient', async () => {
  const multi = service([
    product('a', [5, 0, 0, 0]),
    product('b', [0, 0, 0, 0]),
  ]);
  await assert.rejects(
    multi.service.create(
      input([
        { productId: 'a', quantity: 2 },
        { productId: 'b', quantity: 1 },
      ]),
    ),
    { code: 'INSUFFICIENT_INVENTORY' },
  );
  assert.equal(multi.repository.active.get('a') ?? 0, 0);
  assert.equal(multi.repository.orders.length, 0);
});

test('release and consume transition ACTIVE reservations idempotently', async () => {
  let status: 'ACTIVE' | 'RELEASED' | 'CONSUMED' = 'ACTIVE';
  const repository = {
    async releaseForOrder() {
      if (status !== 'ACTIVE') return { count: 0 };
      status = 'RELEASED';
      return { count: 1 };
    },
    async consumeForOrder() {
      if (status !== 'ACTIVE') return { count: 0 };
      status = 'CONSUMED';
      return { count: 1 };
    },
  };
  const lifecycle = new InventoryReservationService(repository as never);
  assert.deepEqual(await lifecycle.releaseForOrder('order-1'), {
    transitioned: 1,
  });
  assert.deepEqual(await lifecycle.releaseForOrder('order-1'), {
    transitioned: 0,
  });
  assert.equal(
    projectApprovedInventory([{ smaregiStoreId: '1', quantity: 2 }], 0)
      .availableQuantity,
    2,
  );

  status = 'ACTIVE';
  assert.deepEqual(await lifecycle.consumeForOrder('order-1'), {
    transitioned: 1,
  });
  assert.deepEqual(await lifecycle.consumeForOrder('order-1'), {
    transitioned: 0,
  });
});

test('locks Product rows in stable sorted order', async () => {
  const locked: string[] = [];
  const statements: string[] = [];
  const database = {
    inventoryReservation: {},
    async $transaction(operation: (transaction: unknown) => Promise<unknown>) {
      return operation({
        async $queryRaw(query: { strings: string[]; values: unknown[] }) {
          statements.push(query.strings.join('?'));
          locked.push(String(query.values[0]));
          return [];
        },
      });
    },
  };
  const repository = new InventoryReservationRepository(database as never);
  await repository.withLockedProducts(['b', 'a', 'b'], async () => undefined);
  assert.deepEqual(locked, ['a', 'b']);
  assert.ok(statements.every((statement) => statement.includes('FOR UPDATE')));
});
