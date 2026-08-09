import { InventoryMirrorRepository } from '@/repositories/inventory-mirror.repository';
import type { ProductInventoryRecord } from '@/types/product';

export class InventoryService {
  public constructor(
    private readonly inventoryMirrorRepository = new InventoryMirrorRepository(),
  ) {}

  public async getByProductId(
    productId: string,
  ): Promise<ProductInventoryRecord[]> {
    const inventory =
      await this.inventoryMirrorRepository.findByProductId(productId);

    return inventory.map((item) => ({
      quantity: item.quantity,
      reservedQuantity: item.reservedQuantity,
      availableQuantity: item.availableQuantity,
      lastSyncedAt: item.lastSyncedAt.toISOString(),
    }));
  }
}
