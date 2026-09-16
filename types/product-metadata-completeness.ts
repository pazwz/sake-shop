export const PRODUCT_METADATA_FIELD = {
  PRODUCER: 'producer',
  ORIGIN: 'origin',
  VOLUME: 'volume',
  ALCOHOL_PERCENTAGE: 'alcoholPercentage',
  DESCRIPTION: 'description',
  IMAGE: 'image',
  TASTING_NOTES: 'tastingNotes',
} as const;

export type ProductMetadataField =
  (typeof PRODUCT_METADATA_FIELD)[keyof typeof PRODUCT_METADATA_FIELD];

export const PRODUCT_METADATA_FIELD_LABEL: Record<
  ProductMetadataField,
  string
> = {
  producer: '生産者',
  origin: '産地',
  volume: '容量',
  alcoholPercentage: 'アルコール度数',
  description: '商品説明',
  image: '商品画像',
  tastingNotes: 'テイスティング',
};

export const PRODUCT_METADATA_STATUS = {
  COMPLETE: 'COMPLETE',
  CORE_INCOMPLETE: 'CORE_INCOMPLETE',
  OPTIONAL_INCOMPLETE: 'OPTIONAL_INCOMPLETE',
} as const;

export type ProductMetadataStatus =
  (typeof PRODUCT_METADATA_STATUS)[keyof typeof PRODUCT_METADATA_STATUS];

export type ProductMetadataCompleteness = {
  status: ProductMetadataStatus;
  missingCoreFields: ProductMetadataField[];
  missingOptionalFields: ProductMetadataField[];
  missingFields: ProductMetadataField[];
};
