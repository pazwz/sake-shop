import { SMAREGI_APPROVED_STORE_IDS } from '@/config/smaregi';
import { AppError } from '@/lib/errors';
import { resolveStandardTaxRate } from '@/services/smaregi/smaregi-tax-resolver';
import type {
  SmaregiCategory,
  SmaregiConsumptionTaxRate,
  SmaregiProduct,
  SmaregiStock,
  SmaregiStore,
} from '@/types/smaregi';
import type { ValidatedSmaregiSyncPlan } from '@/types/smaregi-sync-plan';
import type { SmaregiDryRunSnapshot } from '@/types/smaregi-dry-run';

type ProductionSourceSnapshot = {
  targetDate: string;
  stores: SmaregiStore[];
  categories: SmaregiCategory[];
  products: SmaregiProduct[];
  stock: SmaregiStock[];
  standardTaxRates: SmaregiConsumptionTaxRate[];
};

export class SmaregiProductionValidationService {
  public validateSource(snapshot: ProductionSourceSnapshot) {
    this.requireNonEmpty(snapshot.categories, 'categories');
    this.requireNonEmpty(snapshot.products, 'products');
    this.requireExactStores(snapshot.stores);
    this.requireUnique(
      snapshot.categories.map((item) => item.categoryId),
      'categoryId',
    );
    this.requireUnique(
      snapshot.products.map((item) => item.productId),
      'productId',
    );
    this.requireUnique(
      snapshot.products.map((item) => item.productCode),
      'productCode',
    );
    this.requireUnique(
      snapshot.stock.map((item) => `${item.productId}\u0000${item.storeId}`),
      'stock identity',
    );
    const categoryIds = new Set(
      snapshot.categories.map((item) => item.categoryId),
    );
    if (
      snapshot.categories.some(
        (item) =>
          item.parentCategoryId !== null &&
          !categoryIds.has(item.parentCategoryId),
      )
    ) {
      this.fatal('Smaregi category hierarchy is incomplete.');
    }
    if (snapshot.products.some((item) => !categoryIds.has(item.categoryId))) {
      this.fatal('Smaregi product references an unknown category.');
    }
    this.requireAcyclicCategories(snapshot.categories);
    const approvedStores = new Set<string>(SMAREGI_APPROVED_STORE_IDS);
    if (snapshot.stock.some((item) => !approvedStores.has(item.storeId))) {
      this.fatal('Smaregi stock contains an unknown store.');
    }
    resolveStandardTaxRate(snapshot.standardTaxRates, snapshot.targetDate);
  }

  public validatePlan(plan: ValidatedSmaregiSyncPlan) {
    const safeProductIds = new Set(
      plan.products.map((item) => item.product.productId),
    );
    const excludedIds = new Set([
      ...plan.approvedDeferredProducts.map((item) => item.smaregiProductId),
      ...plan.quarantinedProducts.map((item) => item.smaregiProductId),
    ]);
    if (
      plan.inventory.some(
        (item) =>
          !safeProductIds.has(item.smaregiProductId) ||
          excludedIds.has(item.smaregiProductId),
      )
    ) {
      this.fatal('Smaregi inventory plan contains an excluded product.');
    }
    const expectedStores = [...SMAREGI_APPROVED_STORE_IDS].sort();
    for (const productId of safeProductIds) {
      const stores = plan.inventory
        .filter((item) => item.smaregiProductId === productId)
        .map((item) => item.smaregiStoreId)
        .sort();
      if (JSON.stringify(stores) !== JSON.stringify(expectedStores)) {
        this.fatal('Smaregi inventory plan is incomplete.');
      }
    }
  }

  public validateSnapshot(
    snapshot: SmaregiDryRunSnapshot,
    sourceProducts: SmaregiProduct[],
  ) {
    this.requireUnique(
      snapshot.products.map((item) => item.smaregiProductId),
      'Neon product identity',
    );
    this.requireUnique(
      snapshot.inventory.map(
        (item) => `${item.productId}\u0000${item.smaregiStoreId}`,
      ),
      'Neon inventory identity',
    );
    const localByProductCode = new Map<string, string[]>();
    for (const product of snapshot.products) {
      const identities = localByProductCode.get(product.productCode) ?? [];
      identities.push(product.smaregiProductId);
      localByProductCode.set(product.productCode, identities);
    }
    for (const product of sourceProducts) {
      const identities = localByProductCode.get(product.productCode) ?? [];
      if (
        identities.some(
          (smaregiProductId) => smaregiProductId !== product.productId,
        )
      ) {
        this.fatal('Neon productCode conflicts with Smaregi product identity.');
      }
    }
  }

  private requireExactStores(stores: SmaregiStore[]) {
    const actual = stores.map((item) => item.storeId).sort();
    const expected = [...SMAREGI_APPROVED_STORE_IDS].sort();
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      this.fatal('Smaregi store set does not match the approved store policy.');
    }
  }

  private requireUnique(values: string[], field: string) {
    if (new Set(values).size !== values.length) {
      this.fatal(`Smaregi ${field} is duplicated.`);
    }
  }

  private requireAcyclicCategories(categories: SmaregiCategory[]) {
    const byId = new Map(categories.map((item) => [item.categoryId, item]));
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const visit = (category: SmaregiCategory) => {
      if (visited.has(category.categoryId)) return;
      if (visiting.has(category.categoryId)) {
        this.fatal('Smaregi category hierarchy contains a cycle.');
      }
      visiting.add(category.categoryId);
      if (category.parentCategoryId) {
        const parent = byId.get(category.parentCategoryId);
        if (parent) visit(parent);
      }
      visiting.delete(category.categoryId);
      visited.add(category.categoryId);
    };
    categories.forEach(visit);
  }

  private requireNonEmpty(values: unknown[], field: string) {
    if (values.length === 0) this.fatal(`Smaregi ${field} is empty.`);
  }

  private fatal(message: string): never {
    throw new AppError(message, 'SMAREGI_FATAL_SOURCE_ANOMALY', 422);
  }
}
