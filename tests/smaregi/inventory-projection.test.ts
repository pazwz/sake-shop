import assert from 'node:assert/strict';
import test from 'node:test';
import {
  projectApprovedInventory,
  requiresTransferForQuantity,
} from '@/services/inventory-projection.service';

const project = (
  quantities: [number, number, number, number],
  activeReservedQuantity = 0,
) =>
  projectApprovedInventory(
    ['1', '2', '3', '6'].map((smaregiStoreId, index) => ({
      smaregiStoreId,
      quantity: quantities[index],
    })),
    activeReservedQuantity,
  );

test('aggregates all four approved stores and ignores other stores', () => {
  const result = projectApprovedInventory(
    [
      { smaregiStoreId: '1', quantity: 2 },
      { smaregiStoreId: '2', quantity: 3 },
      { smaregiStoreId: '3', quantity: 4 },
      { smaregiStoreId: '6', quantity: 5 },
      { smaregiStoreId: '99', quantity: 100 },
    ],
    0,
  );
  assert.equal(result.physicalTotalApproved, 14);
  assert.equal(result.availableQuantity, 14);
});

test('determines direct fulfillment, transfer, and insufficient inventory', () => {
  assert.equal(requiresTransferForQuantity(project([5, 0, 0, 0]), 4), false);
  assert.equal(requiresTransferForQuantity(project([1, 2, 2, 0]), 4), true);
  assert.throws(() => requiresTransferForQuantity(project([1, 1, 0, 0]), 3), {
    code: 'INSUFFICIENT_INVENTORY',
  });
  assert.throws(() => requiresTransferForQuantity(project([1, 1, 0, 0]), 0), {
    code: 'INVALID_ORDER_QUANTITY',
  });
});

test('subtracts allocated reservations once and clamps negative availability', () => {
  const reserved = project([3, 2, 0, 0], 2);
  assert.equal(reserved.activeReservedQuantity, 2);
  assert.equal(reserved.availableQuantity, 3);
  assert.equal(reserved.store1UsableForNewOrder, 1);

  const negative = project([-3, 1, 0, 0]);
  assert.equal(negative.physicalTotalApproved, -2);
  assert.equal(negative.availableQuantity, 0);
});

test('uses existing product-level reservations conservatively for transfer', () => {
  const projection = project([1, 4, 0, 0], 1);
  assert.equal(projection.availableQuantity, 4);
  assert.equal(projection.store1UsableForNewOrder, 0);
  assert.equal(requiresTransferForQuantity(projection, 1), true);
});
