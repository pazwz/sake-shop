import { SMAREGI_SYSTEM } from '@/config/smaregi';
import { AppError } from '@/lib/errors';
import { SmaregiSyncRepository } from '@/repositories/smaregi-sync.repository';
import { SyncRepository } from '@/repositories/sync.repository';
import { SmaregiClient } from '@/services/smaregi/smaregi-client';
import { SmaregiStoreService } from '@/services/smaregi/smaregi-store.service';
import {
  getSmaregiTargetDate,
  resolveProductTax,
} from '@/services/smaregi/smaregi-tax-resolver';
import type { SmaregiApiClient, SmaregiSyncSummary } from '@/types/smaregi';

type ProductSyncPersistence = {
  upsertCategory: SmaregiSyncRepository['upsertCategory'];
  upsertProduct: SmaregiSyncRepository['upsertProduct'];
};
type SyncLogPersistence = Pick<SyncRepository, 'start' | 'succeed' | 'fail'>;
type StoreVerifier = Pick<SmaregiStoreService, 'verifyConfiguredStore'>;

export class SmaregiProductSyncService {
  public constructor(
    private readonly client: SmaregiApiClient = new SmaregiClient(),
    private readonly repository: ProductSyncPersistence = new SmaregiSyncRepository(),
    private readonly logs: SyncLogPersistence = new SyncRepository(),
    private readonly stores: StoreVerifier = new SmaregiStoreService(client),
  ) {}

  public async fullSync(): Promise<SmaregiSyncSummary> {
    const log = await this.logs.start('PRODUCT', 'FULL', 'FULL_SYNC');
    try {
      await this.stores.verifyConfiguredStore();
      const categories = await this.client.getCategories();
      const [standardTaxRates, reduceTaxRates] = await Promise.all([
        this.client.getConsumptionTaxRates(),
        this.client.getReduceTaxRates(),
      ]);
      const categoryBySmaregiId = new Map(
        categories.map((category) => [category.categoryId, category]),
      );
      const savedCategories = new Map<string, string>();
      for (const category of categories) {
        const saved = await this.repository.upsertCategory(category, null);
        savedCategories.set(category.categoryId, saved.id);
      }
      for (const category of categories) {
        if (!category.parentCategoryId) continue;
        const parentId = savedCategories.get(category.parentCategoryId);
        if (!parentId)
          throw new AppError(
            `Smaregi parent category ${category.parentCategoryId} is missing.`,
            'SMAREGI_CATEGORY_MAPPING_FAILED',
            422,
          );
        await this.repository.upsertCategory(category, parentId);
      }

      const products = await this.client.getProducts();
      const summary: SmaregiSyncSummary = {
        processed: products.length,
        created: 0,
        updated: 0,
        skipped: 0,
      };
      for (const product of products) {
        const categoryId = savedCategories.get(product.categoryId);
        if (!categoryId) {
          throw new AppError(
            `Smaregi category ${product.categoryId} for product ${product.productId} is missing.`,
            'SMAREGI_PRODUCT_MAPPING_FAILED',
            422,
          );
        }
        const tax = resolveProductTax(
          product,
          categoryBySmaregiId.get(product.categoryId),
          standardTaxRates,
          reduceTaxRates,
          getSmaregiTargetDate(),
        );
        const result = await this.repository.upsertProduct(
          product,
          categoryId,
          tax.resolvedTaxRate,
        );
        summary[result.created ? 'created' : 'updated'] += 1;
      }
      await this.logs.succeed(log.id, summary, this.client.retryCount);
      return summary;
    } catch (error) {
      await this.logs.fail(
        log.id,
        this.safeError(error),
        this.client.retryCount,
      );
      throw error;
    }
  }

  private safeError(error: unknown) {
    return error instanceof Error
      ? error.message
      : `${SMAREGI_SYSTEM} product sync failed.`;
  }
}
