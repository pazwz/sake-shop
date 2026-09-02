import { InventoryReservationRepository } from '@/repositories/inventory-reservation.repository';

export class InventoryReservationService {
  public constructor(
    private readonly repository = new InventoryReservationRepository(),
  ) {}

  public async releaseForOrder(orderId: string) {
    const result = await this.repository.releaseForOrder(orderId);
    return { transitioned: result.count };
  }

  public async consumeForOrder(orderId: string) {
    const result = await this.repository.consumeForOrder(orderId);
    return { transitioned: result.count };
  }
}
