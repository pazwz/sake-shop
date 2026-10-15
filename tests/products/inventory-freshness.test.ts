import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CartProvider } from '@/components/cart-provider';
import { ProductDetail } from '@/components/product-detail';
import type { ProductRecord } from '@/types/product';

test('storefront shows inventory freshness and does not promise daily mirrored stock is real-time', () => {
  const product: ProductRecord = {
    id: 'product', slug: 'test', name: 'Test product', productCode: 'TEST',
    producer: null, origin: null, category: { id: 'c', name: '酒', slug: 'sake', parent: null },
    price: 1000, taxRate: 10, volume: null, alcoholPercentage: null,
    description: null, tastingNotes: null, images: [],
    inventory: [{ quantity: 1, reservedQuantity: 0, availableQuantity: 1, lastSyncedAt: '2026-10-14T00:00:00Z' }],
    physicalTotalApproved: 1, store1Physical: 1, activeReservedQuantity: 0,
    availableQuantity: 1, boxOption: null, isEcAvailable: true, createdAt: '2026-10-14T00:00:00Z',
  };
  const html = renderToStaticMarkup(createElement(CartProvider, null, createElement(ProductDetail, { product, related: [] })));
  assert.match(html, /在庫情報の最終更新/);
  assert.match(html, /2026\/10\/14/);
  assert.match(html, /実店舗での販売により、実際の在庫が変わる場合があります。/);
});
