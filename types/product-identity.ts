export const PRODUCT_IDENTITY_TYPES = [
  'STANDARD_SPIRIT',
  'VINTAGE_WINE',
  'BURGUNDY_WINE',
  'SAKE',
  'LIMITED_EDITION',
  'BATCH_RELEASE',
  'MINIATURE',
  'PACKAGE_SET',
  'REQUIRES_IDENTITY_REVIEW',
] as const;

export type ProductIdentityType = (typeof PRODUCT_IDENTITY_TYPES)[number];

export const PRODUCT_IDENTITY_REJECTION_REASONS = [
  'PRODUCER_REQUIRED_FOR_DISAMBIGUATION',
  'VINTAGE_REQUIRED',
  'AGE_REQUIRED',
  'BATCH_REQUIRED',
  'EDITION_REQUIRED',
  'VARIANT_REQUIRED',
  'VOLUME_REQUIRED',
  'VOLUME_CONFLICT',
  'PACKAGE_CONFLICT',
  'PACKAGE_COMPOSITION_REQUIRED',
  'AMBIGUOUS_GENERIC_NAME',
  'NO_USABLE_IMAGE',
  'REQUIRES_IDENTITY_REVIEW',
  'IDENTITY_EVIDENCE_INSUFFICIENT',
] as const;

export type ProductIdentityRejectionReason =
  (typeof PRODUCT_IDENTITY_REJECTION_REASONS)[number];

export type ProductIdentityMatch =
  | 'HARD_CONFLICT'
  | 'STRONG_MATCH'
  | 'SUPPORTING_MATCH'
  | 'UNKNOWN';

export type ProductBrandSource =
  | 'REGISTRY'
  | 'DB_NAME'
  | 'EVIDENCE'
  | 'UNKNOWN';

export type ProductPackageType =
  | 'BOX'
  | 'WOODEN_BOX'
  | 'GIFT_BOX'
  | 'SET'
  | 'NO_BOX'
  | 'CASE'
  | 'UNKNOWN';

export type ProductPackageIdentity = {
  type: ProductPackageType;
  quantity: number | null;
  descriptor: string | null;
  components: string[];
  compositionKnown: boolean;
};

export type ProductIdentityField =
  | 'brand'
  | 'product'
  | 'producer'
  | 'vintage'
  | 'age'
  | 'batch'
  | 'edition'
  | 'variant'
  | 'volume'
  | 'package'
  | 'packageComposition'
  | 'productCode';

export type ProductIdentityAliases = {
  japanese: string[];
  kana: string[];
  romaji: string[];
  english: string[];
  chinese: string[];
  normalized: string[];
  brand: string[];
  producer: string[];
  product: string[];
};

export type ProductIdentityProfile = {
  smaregiProductId: string;
  productCode: string;
  originalName: string;
  categoryName: string | null;
  identityType: ProductIdentityType;
  brand: string | null;
  brandSource: ProductBrandSource;
  coreProductName: string;
  producer: string | null;
  knownProducer: string | null;
  age: string | null;
  vintage: string | null;
  batch: string | null;
  edition: string | null;
  editionRequiresDetail: boolean;
  variant: string | null;
  volume: string | null;
  package: ProductPackageIdentity | null;
  aliases: ProductIdentityAliases;
  officialDomains: string[];
  ambiguousGenericName: boolean;
};

export type ProductIdentityInput = {
  smaregiProductId: string;
  productCode: string;
  originalName: string;
  categoryName?: string | null;
  producer?: string | null;
  identityType?: ProductIdentityType;
  brand?: string | null;
  evidenceBrand?: string | null;
  coreProductName?: string | null;
  age?: string | null;
  vintage?: string | null;
  batch?: string | null;
  edition?: string | null;
  variant?: string | null;
  volume?: string | null;
  package?: string | ProductPackageIdentity | null;
};

export type ProductImageIdentityEvidence = {
  sourceType:
    | 'BRAND_OFFICIAL'
    | 'PRODUCER_OFFICIAL'
    | 'OFFICIAL_ARCHIVE'
    | 'OFFICIAL_SHOP'
    | 'IMPORTER_DISTRIBUTOR'
    | 'MARKETPLACE'
    | 'SPECIALIST_RETAILER'
    | 'REGULAR_RETAILER'
    | 'IMAGE_SEARCH'
    | 'OTHER';
  sourceDomain?: string | null;
  title?: string | null;
  brand?: string | null;
  productName?: string | null;
  producer?: string | null;
  productCode?: string | null;
  age?: string | null;
  vintage?: string | null;
  batch?: string | null;
  edition?: string | null;
  variant?: string | null;
  volume?: string | null;
  package?: string | ProductPackageIdentity | null;
  ambiguousProducerCandidates?: string[];
  ambiguousBatchCandidates?: string[];
  usableImage: boolean;
};

export type ProductIdentityFieldMatches = {
  brandMatch: ProductIdentityMatch;
  productMatch: ProductIdentityMatch;
  vintageMatch: ProductIdentityMatch;
  ageMatch: ProductIdentityMatch;
  batchMatch: ProductIdentityMatch;
  editionMatch: ProductIdentityMatch;
  variantMatch: ProductIdentityMatch;
  volumeMatch: ProductIdentityMatch;
  packageMatch: ProductIdentityMatch;
  productCodeMatch: ProductIdentityMatch;
  producerMatch: ProductIdentityMatch;
};

export type ProductImageIdentityDecision = {
  smaregiProductId: string;
  productCode: string;
  identityType: ProductIdentityType;
  identityConfirmed: boolean;
  imageIdentityApproved: boolean;
  approved: boolean;
  score: number;
  requiredFields: ProductIdentityField[];
  matchedFields: ProductIdentityField[];
  unknownRequiredFields: ProductIdentityField[];
  hardConflicts: ProductIdentityField[];
  rejectionReason: ProductIdentityRejectionReason | null;
  matches: ProductIdentityFieldMatches;
  evaluatedAt: string;
};

export type ProductMetadataCompleteness = {
  hasImage: boolean;
  hasProducer: boolean;
  hasDescription: boolean;
  complete: boolean;
};
