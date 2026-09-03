import { AppError } from '@/lib/errors';
import { toExternalSlug } from '@/lib/slug';
import { SmaregiDryRunRepository } from '@/repositories/smaregi-dry-run.repository';
import { SmaregiClient } from '@/services/smaregi/smaregi-client';
import {
  isApprovedDeferredSmaregiProduct,
  isApprovedDeferredSmaregiProductId,
} from '@/services/smaregi/smaregi-deferred-policy';
import {
  getMissingApprovedSmaregiStoreIds,
  getSmaregiSpecialProductKind,
  selectApprovedSmaregiStores,
} from '@/services/smaregi/smaregi-store-policy';
import {
  getSmaregiTargetDate,
  resolveProductTax,
  SmaregiTaxResolutionError,
  type ResolvedSmaregiProductTax,
} from '@/services/smaregi/smaregi-tax-resolver';
import type { SmaregiApiClient, SmaregiProduct } from '@/types/smaregi';
import type {
  DryRunFieldChange,
  DryRunValue,
  SmaregiDryRunInventoryChange,
  SmaregiDryRunResult,
  SmaregiDryRunSnapshot,
} from '@/types/smaregi-dry-run';

type DryRunPersistence = Pick<SmaregiDryRunRepository, 'getSnapshot'>;

export const SMAREGI_PRODUCT_ACTIVE_RULE = {
  displayFlag: '1',
  salesDivision: '0',
  division: '0',
} as const;

export const LINXAS_PROTECTED_PRODUCT_FIELDS = [
  'slug',
  'description',
  'tastingNotes',
  'images',
  'isEcAvailable',
  'seo',
  'featuredCollections',
  'editorialSections',
  'story',
  'tags',
  'recommendations',
  'displayOrder',
  'taxRate',
] as const;

export class SmaregiDryRunService {
  public constructor(
    private readonly client: SmaregiApiClient = new SmaregiClient(),
    private readonly repository: DryRunPersistence = new SmaregiDryRunRepository(),
    private readonly targetDate = getSmaregiTargetDate(),
  ) {}

  public async dryRun(): Promise<SmaregiDryRunResult> {
    const [
      stores,
      categories,
      products,
      standardTaxRates,
      reduceTaxRates,
      snapshot,
    ] = await Promise.all([
      this.client.getStores(),
      this.client.getCategories(),
      this.client.getProducts(),
      this.client.getConsumptionTaxRates(),
      this.client.getReduceTaxRates(),
      this.repository.getSnapshot(),
    ]);
    const approvedStores = selectApprovedSmaregiStores(stores, false);
    const stockByStore = await Promise.all(
      approvedStores.map(async (store) => ({
        storeId: store.storeId,
        storeName: store.storeName ?? null,
        stock: await this.client.getStock(store.storeId),
      })),
    );

    const categoryBySmaregiId = new Map(
      categories.map((category) => [category.categoryId, category]),
    );
    const resolvedTaxes = new Map<string, ResolvedSmaregiProductTax>();
    const approvedDeferredProducts: SmaregiDryRunResult['products']['approvedDeferredProducts'] =
      [];
    const blocked: SmaregiDryRunResult['products']['blocked'] = [];
    for (const product of products) {
      try {
        const resolvedTax = resolveProductTax(
          product,
          categoryBySmaregiId.get(product.categoryId),
          standardTaxRates,
          reduceTaxRates,
          this.targetDate,
        );
        if (isApprovedDeferredSmaregiProductId(product.productId)) {
          approvedDeferredProducts.push({
            smaregiProductId: product.productId,
            productCode: product.productCode,
            productName: product.productName,
            code: 'DEFERRED_NOW_RESOLVABLE',
          });
          continue;
        }
        resolvedTaxes.set(product.productId, resolvedTax);
      } catch (error) {
        if (!(error instanceof SmaregiTaxResolutionError)) throw error;
        if (
          isApprovedDeferredSmaregiProduct(product.productId, error.blockCode)
        ) {
          approvedDeferredProducts.push({
            smaregiProductId: product.productId,
            productCode: product.productCode,
            productName: product.productName,
            code: error.blockCode,
          });
          continue;
        }
        blocked.push({
          smaregiProductId: product.productId,
          productCode: product.productCode,
          code: error.blockCode,
        });
      }
    }
    const eligibleProducts = products.filter((product) =>
      resolvedTaxes.has(product.productId),
    );
    const anomalies = this.createStockAnomalies(products, stockByStore);

    return {
      storesUsed: approvedStores.map((store) => ({
        storeId: store.storeId,
        storeName: store.storeName ?? null,
      })),
      anomalies: {
        missingApprovedStoreIds: getMissingApprovedSmaregiStoreIds(stores),
        ...anomalies,
      },
      categories: this.compareCategories(categories, snapshot),
      products: this.compareProducts(
        eligibleProducts,
        resolvedTaxes,
        approvedDeferredProducts,
        blocked,
        snapshot,
      ),
      inventory: this.compareInventory(
        eligibleProducts,
        stockByStore,
        snapshot,
      ),
    };
  }

  private compareCategories(
    categories: Awaited<ReturnType<SmaregiApiClient['getCategories']>>,
    snapshot: SmaregiDryRunSnapshot,
  ): SmaregiDryRunResult['categories'] {
    const result: SmaregiDryRunResult['categories'] = {
      toCreate: [],
      toUpdate: [],
      unchanged: [],
      toDeactivate: [],
    };
    const localBySmaregiId = new Map(
      snapshot.categories
        .filter((category) => category.smaregiCategoryId !== null)
        .map((category) => [category.smaregiCategoryId as string, category]),
    );
    const localById = new Map(
      snapshot.categories.map((category) => [category.id, category]),
    );

    for (const category of categories) {
      const displayOrder = this.parseInteger(
        category.displaySequence,
        'displaySequence',
      );
      const isActive = category.displayFlag === '1';
      const existing = localBySmaregiId.get(category.categoryId);
      if (!existing) {
        result.toCreate.push({
          smaregiCategoryId: category.categoryId,
          categoryCode: category.categoryCode,
          name: category.categoryName,
          suggestedSlug: toExternalSlug(
            'smaregi-category',
            category.categoryCode,
            category.categoryId,
          ),
          parentSmaregiCategoryId: category.parentCategoryId,
          displayOrder,
          isActive,
        });
        continue;
      }

      const currentParentSmaregiId = existing.parentId
        ? (localById.get(existing.parentId)?.smaregiCategoryId ?? null)
        : null;
      const changes = this.changes([
        ['name', existing.name, category.categoryName],
        ['parentCategoryId', currentParentSmaregiId, category.parentCategoryId],
        ['displayOrder', existing.displayOrder, displayOrder],
        ['isActive', existing.isActive, isActive],
      ]);
      const change = {
        smaregiCategoryId: category.categoryId,
        changes,
      };
      if (existing.isActive && !isActive) result.toDeactivate.push(change);
      else if (changes.length > 0) result.toUpdate.push(change);
      else result.unchanged.push({ smaregiCategoryId: category.categoryId });
    }
    return result;
  }

  private compareProducts(
    products: SmaregiProduct[],
    resolvedTaxes: Map<string, ResolvedSmaregiProductTax>,
    approvedDeferredProducts: SmaregiDryRunResult['products']['approvedDeferredProducts'],
    blocked: SmaregiDryRunResult['products']['blocked'],
    snapshot: SmaregiDryRunSnapshot,
  ): SmaregiDryRunResult['products'] {
    const result: SmaregiDryRunResult['products'] = {
      toCreate: [],
      toUpdate: [],
      unchanged: [],
      toDeactivate: [],
      approvedDeferredProducts,
      blocked,
    };
    const localBySmaregiId = new Map(
      snapshot.products.map((product) => [product.smaregiProductId, product]),
    );
    const categoryById = new Map(
      snapshot.categories.map((category) => [category.id, category]),
    );

    for (const product of products) {
      const tax = resolvedTaxes.get(product.productId);
      if (!tax)
        throw new AppError(
          'Resolved Smaregi tax is missing.',
          'SMAREGI_DRY_RUN_VALIDATION_FAILED',
          422,
        );
      const price = tax.price;
      const isActive = this.isActiveProduct(product);
      const existing = localBySmaregiId.get(product.productId);
      if (!existing) {
        result.toCreate.push({
          smaregiProductId: product.productId,
          productCode: product.productCode,
          name: product.productName,
          suggestedSlug: toExternalSlug(
            'smaregi-product',
            product.productCode,
            product.productId,
          ),
          categorySmaregiCategoryId: product.categoryId,
          price,
          isActive,
          taxDivision: tax.taxDivision,
          resolvedTaxRate: tax.resolvedTaxRate,
          priceMeaning: tax.priceMeaning,
          taxResolutionSource: tax.taxResolutionSource,
        });
        continue;
      }

      const currentCategorySmaregiId =
        categoryById.get(existing.categoryId)?.smaregiCategoryId ?? null;
      const changes = this.changes([
        ['productCode', existing.productCode, product.productCode],
        ['name', existing.name, product.productName],
        ['categoryId', currentCategorySmaregiId, product.categoryId],
        ['price', this.normalizeStoredPrice(existing.price), price],
        ['isActive', existing.isActive, isActive],
      ]);
      const change = {
        smaregiProductId: product.productId,
        productCode: product.productCode,
        changes,
        taxDivision: tax.taxDivision,
        resolvedTaxRate: tax.resolvedTaxRate,
        priceMeaning: tax.priceMeaning,
        taxResolutionSource: tax.taxResolutionSource,
      };
      if (existing.isActive && !isActive) result.toDeactivate.push(change);
      else if (changes.length > 0) result.toUpdate.push(change);
      else
        result.unchanged.push({
          smaregiProductId: product.productId,
          productCode: product.productCode,
          taxDivision: tax.taxDivision,
          resolvedTaxRate: tax.resolvedTaxRate,
          priceMeaning: tax.priceMeaning,
          taxResolutionSource: tax.taxResolutionSource,
        });
    }
    return result;
  }

  private compareInventory(
    products: SmaregiProduct[],
    stockByStore: Array<{
      storeId: string;
      storeName: string | null;
      stock: Awaited<ReturnType<SmaregiApiClient['getStock']>>;
    }>,
    snapshot: SmaregiDryRunSnapshot,
  ): SmaregiDryRunResult['inventory'] {
    const result: SmaregiDryRunResult['inventory'] = {
      toCreate: [],
      toUpdate: [],
      toZero: [],
      unchanged: [],
    };
    const localProductBySmaregiId = new Map(
      snapshot.products.map((product) => [product.smaregiProductId, product]),
    );
    const localInventory = new Map(
      snapshot.inventory.map((inventory) => [
        this.inventoryKey(inventory.productId, inventory.smaregiStoreId),
        inventory,
      ]),
    );

    for (const store of stockByStore) {
      const stockByProductId = new Map(
        store.stock.map((stock) => [stock.productId, stock]),
      );
      for (const product of products) {
        const stock = stockByProductId.get(product.productId);
        const quantity = stock
          ? this.parseInteger(stock.stockAmount, 'stockAmount')
          : 0;
        const layawayStockAmount = stock
          ? this.parseInteger(stock.layawayStockAmount, 'layawayStockAmount')
          : null;
        const localProduct = localProductBySmaregiId.get(product.productId);
        const existing = localProduct
          ? localInventory.get(
              this.inventoryKey(localProduct.id, store.storeId),
            )
          : undefined;
        const change: SmaregiDryRunInventoryChange = {
          smaregiProductId: product.productId,
          productCode: product.productCode,
          storeId: store.storeId,
          quantity: {
            before: existing?.quantity ?? null,
            after: quantity,
          },
          reservedQuantity: {
            preserved: existing?.reservedQuantity ?? 0,
          },
          layawayStockAmount,
        };

        if (!existing) result.toCreate.push(change);
        else if (existing.quantity === quantity)
          result.unchanged.push({
            smaregiProductId: product.productId,
            productCode: product.productCode,
            storeId: store.storeId,
            quantity,
            reservedQuantity: existing.reservedQuantity,
            layawayStockAmount,
          });
        else if (quantity === 0) result.toZero.push(change);
        else result.toUpdate.push(change);
      }
    }
    return result;
  }

  private createStockAnomalies(
    products: SmaregiProduct[],
    stockByStore: Array<{
      storeId: string;
      storeName: string | null;
      stock: Awaited<ReturnType<SmaregiApiClient['getStock']>>;
    }>,
  ): Omit<SmaregiDryRunResult['anomalies'], 'missingApprovedStoreIds'> {
    const productById = new Map(
      products.map((product) => [product.productId, product]),
    );
    const rows = stockByStore.flatMap((store) =>
      store.stock.map((stock) => {
        const product = productById.get(stock.productId);
        return {
          smaregiProductId: stock.productId,
          productCode: product?.productCode ?? null,
          productName: product?.productName ?? null,
          storeId: store.storeId,
          storeName: store.storeName,
          rawStockAmount: this.parseInteger(stock.stockAmount, 'stockAmount'),
          isOrphan: product === undefined,
          specialProductKind: getSmaregiSpecialProductKind(stock.productId),
        };
      }),
    );
    const orphanStock = rows.filter((row) => row.isOrphan);
    const negativeStock = rows.filter((row) => row.rawStockAmount < 0);
    return {
      orphanStockCount: orphanStock.length,
      orphanStock,
      negativeStockCount: negativeStock.length,
      negativeStock,
    };
  }

  private isActiveProduct(product: SmaregiProduct) {
    return (
      product.displayFlag === SMAREGI_PRODUCT_ACTIVE_RULE.displayFlag &&
      product.salesDivision === SMAREGI_PRODUCT_ACTIVE_RULE.salesDivision &&
      product.division === SMAREGI_PRODUCT_ACTIVE_RULE.division
    );
  }

  private parseInteger(value: string, field: string) {
    if (!/^-?\d+$/.test(value))
      throw new AppError(
        `Invalid Smaregi ${field}.`,
        'SMAREGI_DRY_RUN_VALIDATION_FAILED',
        422,
      );
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed))
      throw new AppError(
        `Invalid Smaregi ${field}.`,
        'SMAREGI_DRY_RUN_VALIDATION_FAILED',
        422,
      );
    return parsed;
  }

  private changes(
    candidates: Array<[string, DryRunValue, DryRunValue]>,
  ): DryRunFieldChange[] {
    return candidates
      .filter(([, before, after]) => before !== after)
      .map(([field, before, after]) => ({ field, before, after }));
  }

  private normalizeStoredPrice(value: string) {
    const [whole, fraction = ''] = value.split('.');
    const normalizedFraction = fraction.replace(/0+$/, '');
    return normalizedFraction ? `${whole}.${normalizedFraction}` : whole;
  }

  private inventoryKey(productId: string, storeId: string) {
    return `${productId}\u0000${storeId}`;
  }
}
