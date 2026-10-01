import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CustomerOrderDetail } from '@/components/customer-order-detail';
import { CUSTOMER_PAYMENT_STATUS_LABELS } from '@/config/customer-order';
import {
  OrderRepository,
  customerOrderSelect,
} from '@/repositories/order.repository';
import { CustomerOrderAccessService } from '@/services/customer-order-access.service';
import { SmaregiMissingProductRepository } from '@/repositories/smaregi-missing-product.repository';
import { SmaregiProductImageCleanupService } from '@/services/smaregi/smaregi-product-image-cleanup.service';
import type { CustomerOrderRecord } from '@/repositories/order.repository';
import type { CustomerOrderDetail as Detail } from '@/types/customer-order';

const record = (): CustomerOrderRecord =>
  ({
    id: 'order-1',
    orderNumber: 'TEST-SUPPORT-20260924-001',
    createdAt: new Date('2026-09-24T00:00:00Z'),
    status: 'COMPLETED',
    paymentStatus: 'SUCCEEDED',
    shipmentStatus: 'DELIVERED',
    subtotal: 143000,
    shippingFee: 880,
    taxAmount: 13000,
    discountAmount: 1000,
    totalAmount: 142880,
    paymentMethod: 'card',
    shippingAddressSnapshot: {
      recipientName: '注文時の宛名',
      postalCode: '8100001',
      prefecture: '福岡県',
      city: '福岡市',
      addressLine1: '注文時の住所',
      addressLine2: '注文時の建物',
      phone: '09000000000',
    },
    items: [
      {
        productId: 'product-1',
        productName: '注文時の商品名',
        productCode: 'ORDERED-001',
        productImageUrlSnapshot: 'https://example.test/original.jpg',
        unitPrice: 143000,
        quantity: 1,
        subtotal: 143000,
        product: {
          images: [
            {
              imageUrl: 'https://example.test/current.jpg',
              altText: '現在の商品名',
            },
          ],
        },
      },
    ],
    payments: [
      { status: 'SUCCEEDED', paidAt: new Date('2026-09-24T02:00:00Z') },
    ],
    shipments: [],
    contactInquiries: [],
  }) as unknown as CustomerOrderRecord;

const detail = async (data = record()): Promise<Detail> =>
  new CustomerOrderAccessService(
    { findOwnedByOrderNumber: async () => data } as never,
    async () => ({ id: 'owner' }),
  ).getOrderDetail(data.orderNumber);
const render = (order: Detail) =>
  renderToStaticMarkup(createElement(CustomerOrderDetail, { order }));

test('customer order query scopes every selected relation to order ownership', async () => {
  let query: unknown;
  const repository = new OrderRepository({
    order: {
      findFirst: async (args: unknown) => {
        query = args;
        return null;
      },
    },
  } as never);
  await repository.findOwnedByOrderNumber('customer-b', 'ORDER-A');
  assert.deepEqual(query, {
    where: { orderNumber: 'ORDER-A', customerId: 'customer-b' },
    select: customerOrderSelect,
  });
});

test('historical image and name prefer the order snapshots over changed product data', async () => {
  const order = await detail();
  assert.equal(order.items[0].imageUrl, 'https://example.test/original.jpg');
  assert.equal(order.items[0].imageAlt, '注文時の商品名');
  assert.equal(order.items[0].productName, '注文時の商品名');
  assert.match(render(order), /original\.jpg/);
  assert.doesNotMatch(render(order), /current\.jpg|現在の商品名/);
});

test('asset cleanup retains an image referenced only by a historical order snapshot', async () => {
  const empty = { count: async () => 0 };
  const repository = new SmaregiMissingProductRepository({
    productImage: empty,
    featuredCollection: empty,
    editorialSection: empty,
    shipment: empty,
    orderItem: {
      count: async (query: unknown) => {
        assert.deepEqual(query, {
          where: {
            productImageUrlSnapshot:
              'https://media.example/uploads/original.jpg',
          },
        });
        return 1;
      },
    },
  } as never);
  const previousDomain = process.env.AWS_CLOUDFRONT_DOMAIN;
  process.env.AWS_CLOUDFRONT_DOMAIN = 'media.example';
  let deletes = 0;
  try {
    const cleanup = new SmaregiProductImageCleanupService(
      repository,
      async () => {
        deletes += 1;
      },
    );
    const result = await cleanup.cleanup({
      deletedImages: [
        { imageUrl: 'https://media.example/uploads/original.jpg' },
      ],
    });
    assert.equal(result.retainedSharedCount, 1);
    assert.equal(deletes, 0);
  } finally {
    if (previousDomain === undefined) delete process.env.AWS_CLOUDFRONT_DOMAIN;
    else process.env.AWS_CLOUDFRONT_DOMAIN = previousDomain;
  }
});

test('historical order remains readable without a current product relation', async () => {
  const data = record();
  Object.assign(data.items[0], { product: null });
  assert.equal(
    (await detail(data)).items[0].imageUrl,
    'https://example.test/original.jpg',
  );
});

test('retired or hidden products do not suppress the historical item', async () => {
  const data = record();
  Object.assign(data.items[0].product, {
    isActive: false,
    isEcAvailable: false,
    isManuallyHidden: true,
  });
  assert.equal((await detail(data)).items.length, 1);
  assert.equal(
    (await detail(data)).items[0].imageUrl,
    'https://example.test/original.jpg',
  );
});

test('legacy image fallback uses the current image and then a neutral placeholder', async () => {
  const data = record();
  data.items[0].productImageUrlSnapshot = null;
  assert.equal(
    (await detail(data)).items[0].imageUrl,
    'https://example.test/current.jpg',
  );
  data.items[0].product.images = [];
  assert.equal((await detail(data)).items[0].imageUrl, null);
  assert.match(render(await detail(data)), /画像なし/);
});

test('address is the order snapshot and missing legacy address is not invented', async () => {
  const order = await detail();
  assert.equal(order.shippingAddress?.addressLine1, '注文時の住所');
  assert.match(render(order), /注文時の宛名|注文時の住所|注文時の建物/);
  const data = record();
  data.shippingAddressSnapshot = {};
  assert.equal((await detail(data)).shippingAddress, null);
  assert.match(render(await detail(data)), /お届け先情報は記録されていません/);
});

test('order detail renders Japanese statuses, real payment date, and formatted amounts', async () => {
  const html = render(await detail());
  assert.match(html, /お届け完了/);
  assert.match(html, /支払済み/);
  assert.match(html, /クレジットカード/);
  assert.match(html, /2026年9月24日/);
  assert.match(html, /￥143,000/);
  assert.match(html, /￥142,880/);
  assert.match(html, /−￥1,000/);
  assert.match(html, /うち消費税/);
  assert.doesNotMatch(html, /COMPLETED|SUCCEEDED|DELIVERED|providerPaymentId/);
});

test('all payment states use customer labels without gateway identifiers', async () => {
  for (const status of Object.keys(CUSTOMER_PAYMENT_STATUS_LABELS) as Array<
    keyof typeof CUSTOMER_PAYMENT_STATUS_LABELS
  >) {
    const order = await detail();
    order.payment = { status, paidAt: null };
    order.paymentMethod = 'STERA';
    const html = render(order);
    assert.ok(html.includes(CUSTOMER_PAYMENT_STATUS_LABELS[status]));
    assert.doesNotMatch(html, /STERA|PENDING|FAILED|SUCCEEDED|REQUIRES_REVIEW/);
    assert.match(html, /お支払い方法を確認中/);
  }
});

test('missing shipment and payment are graceful and use only order status', async () => {
  const data = record();
  data.payments = [];
  data.paymentStatus = 'PENDING';
  const html = render(await detail(data));
  assert.match(html, /配送情報はまだ登録されていません/);
  assert.match(html, /お支払い待ち/);
  assert.doesNotMatch(html, /お支払い日|佐川急便/);
});

test('shipment displays recorded carrier, tracking number and timestamps only', async () => {
  const data = record();
  data.shipments = [
    {
      status: 'SHIPPED',
      carrier: 'SAGAWA',
      trackingNumber: '1234567890',
      shippedAt: new Date('2026-09-25T00:00:00Z'),
      deliveredAt: null,
    },
  ];
  const html = render(await detail(data));
  assert.match(html, /佐川急便|1234567890|2026年9月25日/);
  assert.doesNotMatch(html, /SAGAWA|SHIPPED/);
});

test('order number is a wrapping identifier and back/support links retain scope', async () => {
  const order = await detail();
  order.orderNumber = 'LONG-'.repeat(25);
  const html = render(order);
  assert.match(
    html,
    /class="[^"]*break-all[^"]*"[^>]*data-testid="order-number"/,
  );
  assert.match(html, /href="\/account\/orders"/);
  assert.ok(
    html.includes(
      `/account/orders/${encodeURIComponent(order.orderNumber)}/messages`,
    ),
  );
  assert.doesNotMatch(html, /customerId|owner/);
});
