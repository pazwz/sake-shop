import {
  PRODUCT_METADATA_FIELD,
  PRODUCT_METADATA_STATUS,
  type ProductMetadataCompleteness,
  type ProductMetadataField,
} from '@/types/product-metadata-completeness';

type MetadataInput = {
  producer: string | null | undefined;
  origin: string | null | undefined;
  volume: string | null | undefined;
  alcoholPercentage: number | null | undefined;
  description: string | null | undefined;
  tastingNotes: string | null | undefined;
  images: readonly unknown[];
};

const CORE_FIELDS = [
  PRODUCT_METADATA_FIELD.PRODUCER,
  PRODUCT_METADATA_FIELD.ORIGIN,
  PRODUCT_METADATA_FIELD.VOLUME,
  PRODUCT_METADATA_FIELD.ALCOHOL_PERCENTAGE,
  PRODUCT_METADATA_FIELD.DESCRIPTION,
  PRODUCT_METADATA_FIELD.IMAGE,
] as const;

const OPTIONAL_FIELDS = [PRODUCT_METADATA_FIELD.TASTING_NOTES] as const;

const isBlank = (value: string | null | undefined) =>
  value === null || value === undefined || value.trim() === '';

export class ProductMetadataCompletenessService {
  public resolve(input: MetadataInput): ProductMetadataCompleteness {
    const missingCoreFields: ProductMetadataField[] = [
      ...(isBlank(input.producer) ? [PRODUCT_METADATA_FIELD.PRODUCER] : []),
      ...(isBlank(input.origin) ? [PRODUCT_METADATA_FIELD.ORIGIN] : []),
      ...(isBlank(input.volume) ? [PRODUCT_METADATA_FIELD.VOLUME] : []),
      ...(input.alcoholPercentage === null ||
      input.alcoholPercentage === undefined
        ? [PRODUCT_METADATA_FIELD.ALCOHOL_PERCENTAGE]
        : []),
      ...(isBlank(input.description)
        ? [PRODUCT_METADATA_FIELD.DESCRIPTION]
        : []),
      ...(input.images.length === 0 ? [PRODUCT_METADATA_FIELD.IMAGE] : []),
    ];
    const missingOptionalFields: ProductMetadataField[] = isBlank(
      input.tastingNotes,
    )
      ? [PRODUCT_METADATA_FIELD.TASTING_NOTES]
      : [];
    const status = missingCoreFields.length
      ? PRODUCT_METADATA_STATUS.CORE_INCOMPLETE
      : missingOptionalFields.length
        ? PRODUCT_METADATA_STATUS.OPTIONAL_INCOMPLETE
        : PRODUCT_METADATA_STATUS.COMPLETE;
    return {
      status,
      missingCoreFields,
      missingOptionalFields,
      missingFields: [...missingCoreFields, ...missingOptionalFields],
    };
  }

  public get coreFields() {
    return CORE_FIELDS;
  }

  public get optionalFields() {
    return OPTIONAL_FIELDS;
  }
}
