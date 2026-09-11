import type { ProductImageIdentityDecision } from '@/types/product-identity';

export type ProductEnrichmentFields = {
  producer?: string;
  origin?: string;
  volume?: string;
  alcoholPercentage?: number;
  description?: string;
  tastingNotes?: string;
};

export type PreparedProductEnrichmentImage = {
  imageUrl: string;
  contentHash: string;
  altText?: string | null;
  identityDecision: ProductImageIdentityDecision;
};

export type ProductEnrichmentCandidate = {
  productId: string;
  smaregiProductId: string;
  productCode: string;
  fields: ProductEnrichmentFields;
  image?: PreparedProductEnrichmentImage;
};

export type ResolvedProductEnrichmentCandidate = ProductEnrichmentCandidate & {
  productId: string;
};

export type ProductEnrichmentBatchResult = {
  productsExamined: number;
  productsUpdated: number;
  fieldsFilled: number;
  imagesCreated: number;
};

export type ProductEnrichmentRunResult = ProductEnrichmentBatchResult & {
  batchesCommitted: number;
};
