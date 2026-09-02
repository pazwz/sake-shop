import type { SmaregiCategory, SmaregiProduct } from '@/types/smaregi';
import type { SmaregiStockAnomaly } from '@/types/smaregi-dry-run';

export type ValidatedSmaregiSyncPlan = {
  syncedAt: Date;
  storesUsed: string[];
  warnings: {
    orphanStock: SmaregiStockAnomaly[];
    negativeStock: SmaregiStockAnomaly[];
  };
  categories: SmaregiCategory[];
  approvedDeferredProducts: Array<{
    smaregiProductId: string;
    productCode: string;
    productName: string;
    code: 'CATEGORY_TAX_DIVISION_MISSING';
  }>;
  products: Array<{
    product: SmaregiProduct;
    resolvedTaxRate: string;
  }>;
  inventory: Array<{
    smaregiProductId: string;
    smaregiStoreId: string;
    quantity: number;
  }>;
};
