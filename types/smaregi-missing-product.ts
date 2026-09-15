import type { SmaregiMissingProductMode } from '@/config/smaregi';

export type SmaregiMissingProductReferenceCounts = {
  orderItems: number;
  reservations: number;
  collections: number;
  editorialSections: number;
  boxRelations: number;
};

export type SmaregiMissingProductCandidate = {
  id: string;
  smaregiProductId: string;
  productCode: string;
  name: string;
  imageUrls: string[];
  references: SmaregiMissingProductReferenceCounts;
};

export type SmaregiMissingProductPlan = {
  mode: SmaregiMissingProductMode;
  snapshotComplete: true;
  sourceProductCount: number;
  sourceIdentityCount: number;
  sourceProductIds: string[];
  safeToDelete: SmaregiMissingProductCandidate[];
  retire: SmaregiMissingProductCandidate[];
  blocked: SmaregiMissingProductCandidate[];
};

export type SmaregiMissingProductWriteResult = {
  deletedProductCount: number;
  retiredProductCount: number;
  deletedImages: Array<{
    productId: string;
    smaregiProductId: string;
    imageUrl: string;
  }>;
  events: SmaregiProductLifecycleEvent[];
};

export type SmaregiProductLifecycleEvent = {
  smaregiProductId: string;
  productCode: string;
  productName: string;
  type: 'PRODUCT_DELETED' | 'PRODUCT_RETIRED' | 'PRODUCT_SUPPRESSED';
  reason: 'MISSING_FROM_SOURCE' | 'OFFLINE_ONLY';
};

export type SmaregiSuppressionWriteResult = {
  deletedProductCount: number;
  retiredProductCount: number;
  deletedImages: Array<{
    productId: string;
    smaregiProductId: string;
    imageUrl: string;
  }>;
  events: SmaregiProductLifecycleEvent[];
};

export type SmaregiAtomicSyncResult = {
  categories: number;
  products: number;
  inventory: number;
  reconciliation: SmaregiMissingProductWriteResult;
  suppression: SmaregiSuppressionWriteResult;
};

export type SmaregiS3CleanupResult = {
  successCount: number;
  failureCount: number;
  retainedSharedCount: number;
  failures: Array<{ key: string; message: string }>;
};
