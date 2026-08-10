import { PaymentStatus, SyncDirection } from '@prisma/client';
import { AppError, NotFoundError } from '@/lib/errors';
import { OrderRepository } from '@/repositories/order.repository';
import { SyncRepository } from '@/repositories/sync.repository';

export class SmaregiOrderService {
  public constructor(
    private readonly orders = new OrderRepository(),
    private readonly logs = new SyncRepository(),
  ) {}

  public async sync(orderId: string) {
    const log = await this.logs.start(
      'ORDER',
      orderId,
      'CREATE',
      SyncDirection.WEBSITE_TO_SMAREGI,
      { orderId },
    );
    try {
      const order = await this.orders.findById(orderId);
      if (!order) throw new NotFoundError('Order not found.');
      if (order.smaregiOrderId) {
        const result = {
          orderId: order.id,
          smaregiOrderId: order.smaregiOrderId,
        };
        await this.logs.succeed(log.id, result);
        return result;
      }
      if (order.paymentStatus !== PaymentStatus.SUCCEEDED) {
        throw new AppError(
          'Only successfully paid orders can be synchronized to Smaregi.',
          'SMAREGI_ORDER_NOT_PAID',
          409,
        );
      }

      throw new AppError(
        'Smaregi order synchronization is pending customer approval and official field mapping.',
        'SMAREGI_ORDER_SYNC_PENDING_APPROVAL',
        409,
      );
    } catch (error) {
      await this.logs.fail(
        log.id,
        error instanceof Error ? error.message : 'Smaregi order sync failed.',
      );
      throw error;
    }
  }
}
