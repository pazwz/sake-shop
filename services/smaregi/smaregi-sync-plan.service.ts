import { AppError } from '@/lib/errors';
import {
  isApprovedDeferredSmaregiProduct,
} from '@/services/smaregi/smaregi-deferred-policy';
import { resolveProductTax } from '@/services/smaregi/smaregi-tax-resolver';
import { SmaregiTaxResolutionError } from '@/services/smaregi/smaregi-tax-resolver';
import {
  getSmaregiSpecialProductKind,
  selectApprovedSmaregiStores,
} from '@/services/smaregi/smaregi-store-policy';
import type {
  SmaregiCategory,
  SmaregiConsumptionTaxRate,
  SmaregiProduct,
  SmaregiReduceTaxRate,
  SmaregiStock,
  SmaregiStore,
} from '@/types/smaregi';
import type { ValidatedSmaregiSyncPlan } from '@/types/smaregi-sync-plan';

type SmaregiSyncPlanInput = {
  targetDate: string;
  syncedAt: Date;
  stores: SmaregiStore[];
  categories: SmaregiCategory[];
  products: SmaregiProduct[];
  stock: SmaregiStock[];
  standardTaxRates: SmaregiConsumptionTaxRate[];
  reduceTaxRates: SmaregiReduceTaxRate[];
  suppressedSmaregiProductIds?: ReadonlySet<string>;
};

export const buildValidatedSmaregiSyncPlan = (
  input: SmaregiSyncPlanInput,
): ValidatedSmaregiSyncPlan => {
  const categoryById = new Map(
    input.categories.map((category) => [category.categoryId, category]),
  );
  const products: ValidatedSmaregiSyncPlan['products'] = [];
  const approvedDeferredProducts: ValidatedSmaregiSyncPlan['approvedDeferredProducts'] =
    [];
  const quarantinedProducts: ValidatedSmaregiSyncPlan['quarantinedProducts'] =
    [];
  const suppressedProducts: ValidatedSmaregiSyncPlan['suppressedProducts'] =
    [];
  const suppressedIds = input.suppressedSmaregiProductIds ?? new Set<string>();
  const syncCandidates = input.products.filter((product) => {
    if (!suppressedIds.has(product.productId)) return true;
    suppressedProducts.push({
      smaregiProductId: product.productId,
      productCode: product.productCode,
      productName: product.productName,
    });
    return false;
  });
  for (const product of syncCandidates) {
    try {
      const resolvedTaxRate = resolveProductTax(
        product,
        categoryById.get(product.categoryId),
        input.standardTaxRates,
        input.reduceTaxRates,
        input.targetDate,
      ).resolvedTaxRate;
      products.push({ product, resolvedTaxRate });
    } catch (error) {
      if (
        error instanceof SmaregiTaxResolutionError &&
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
      if (error instanceof SmaregiTaxResolutionError) {
        quarantinedProducts.push({
          smaregiProductId: product.productId,
          productCode: product.productCode,
          reasonCode: error.blockCode,
          message: error.message,
        });
        continue;
      }
      throw error;
    }
  }
  const deferredIds = new Set(
    approvedDeferredProducts.map((item) => item.smaregiProductId),
  );
  const quarantinedIds = new Set(
    quarantinedProducts.map((item) => item.smaregiProductId),
  );
  const negativeProductIds = new Set(
    input.stock
      .filter(
        (item) =>
          input.stores.some((store) => store.storeId === item.storeId) &&
          parseStockAmount(item.stockAmount) < 0,
      )
      .map((item) => item.productId),
  );
  for (const item of products) {
    if (!negativeProductIds.has(item.product.productId)) continue;
    quarantinedProducts.push({
      smaregiProductId: item.product.productId,
      productCode: item.product.productCode,
      reasonCode: 'NORMAL_PRODUCT_NEGATIVE_STOCK',
      message: 'Approved-store stock is negative.',
    });
    quarantinedIds.add(item.product.productId);
  }
  const safeProducts = products.filter(
    ({ product }) =>
      !deferredIds.has(product.productId) &&
      !quarantinedIds.has(product.productId),
  );
  const stockByKey = new Map(
    input.stock.map((stock) => [
      inventoryKey(stock.productId, stock.storeId),
      stock,
    ]),
  );
  const approvedStores = selectApprovedSmaregiStores(input.stores);
  const inventory = approvedStores.flatMap((store) =>
    safeProducts.map(({ product }) => {
      const stock = stockByKey.get(
        inventoryKey(product.productId, store.storeId),
      );
      return {
        smaregiProductId: product.productId,
        smaregiStoreId: store.storeId,
        quantity: stock ? parseStockAmount(stock.stockAmount) : 0,
      };
    }),
  );
  const productById = new Map(
    syncCandidates.map((product) => [product.productId, product]),
  );
  const storeById = new Map(
    approvedStores.map((store) => [store.storeId, store]),
  );
  const stockWarnings = input.stock
    .filter(
      (stock) =>
        storeById.has(stock.storeId) && !suppressedIds.has(stock.productId),
    )
    .map((stock) => {
      const product = productById.get(stock.productId);
      return {
        smaregiProductId: stock.productId,
        productCode: product?.productCode ?? null,
        productName: product?.productName ?? null,
        storeId: stock.storeId,
        storeName: storeById.get(stock.storeId)?.storeName ?? null,
        rawStockAmount: parseStockAmount(stock.stockAmount),
        isOrphan: product === undefined,
        specialProductKind: getSmaregiSpecialProductKind(stock.productId),
      };
    });
  return {
    syncedAt: input.syncedAt,
    storesUsed: approvedStores.map((store) => store.storeId),
    warnings: {
      orphanStock: stockWarnings.filter((warning) => warning.isOrphan),
      negativeStock: stockWarnings.filter(
        (warning) => warning.rawStockAmount < 0,
      ),
    },
    categories: input.categories,
    suppressedProducts,
    approvedDeferredProducts,
    quarantinedProducts,
    products: safeProducts,
    inventory,
  };
};

const parseStockAmount = (value: string) => {
  if (!/^-?\d+$/.test(value))
    throw new AppError(
      'Invalid Smaregi stockAmount.',
      'SMAREGI_SYNC_PLAN_VALIDATION_FAILED',
      422,
    );
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed))
    throw new AppError(
      'Invalid Smaregi stockAmount.',
      'SMAREGI_SYNC_PLAN_VALIDATION_FAILED',
      422,
    );
  return parsed;
};

const inventoryKey = (productId: string, storeId: string) =>
  `${productId}\u0000${storeId}`;
