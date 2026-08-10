import { getSmaregiEnvironment, SMAREGI_SYSTEM } from '@/config/smaregi';
import { AppError } from '@/lib/errors';
import { SmaregiSyncRepository } from '@/repositories/smaregi-sync.repository';
import { SyncRepository } from '@/repositories/sync.repository';
import { SmaregiClient } from '@/services/smaregi/smaregi-client';
import { SmaregiStoreService } from '@/services/smaregi/smaregi-store.service';
import type { SmaregiApiClient, SmaregiSyncSummary } from '@/types/smaregi';

type InventorySyncPersistence = Pick<
  SmaregiSyncRepository,
  'findProductBySmaregiId' | 'upsertInventory'
>;
type SyncLogPersistence = Pick<SyncRepository, 'start' | 'succeed' | 'fail'>;
type StoreVerifier = Pick<SmaregiStoreService, 'verifyConfiguredStore'>;

export class SmaregiInventorySyncService {
  public constructor(
    private readonly client: SmaregiApiClient = new SmaregiClient(),
    private readonly repository: InventorySyncPersistence = new SmaregiSyncRepository(),
    private readonly logs: SyncLogPersistence = new SyncRepository(),
    private readonly stores: StoreVerifier = new SmaregiStoreService(client),
  ) {}

  public async fullSync(): Promise<SmaregiSyncSummary> {
    const log = await this.logs.start('INVENTORY', 'FULL', 'FULL_SYNC');
    try {
      await this.stores.verifyConfiguredStore();
      const { SMAREGI_STORE_ID } = getSmaregiEnvironment();
      const stocks = await this.client.getStock(SMAREGI_STORE_ID);
      const summary: SmaregiSyncSummary = {
        processed: stocks.length,
        created: 0,
        updated: 0,
        skipped: 0,
      };
      for (const stock of stocks) {
        const product = await this.repository.findProductBySmaregiId(
          stock.productId,
        );
        if (!product) {
          throw new AppError(
            `Website product for Smaregi product ${stock.productId} is missing.`,
            'SMAREGI_INVENTORY_MAPPING_FAILED',
            422,
          );
        }
        const result = await this.repository.upsertInventory(
          product.id,
          SMAREGI_STORE_ID,
          stock,
        );
        summary[result.created ? 'created' : 'updated'] += 1;
      }
      await this.logs.succeed(log.id, summary, this.client.retryCount);
      return summary;
    } catch (error) {
      await this.logs.fail(
        log.id,
        error instanceof Error
          ? error.message
          : `${SMAREGI_SYSTEM} inventory sync failed.`,
        this.client.retryCount,
      );
      throw error;
    }
  }
}
