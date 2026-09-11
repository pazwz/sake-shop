import { createHash } from 'node:crypto';
import { ProductEnrichmentRepository } from '@/repositories/product-enrichment.repository';
import type {
  ProductEnrichmentCandidate,
  ProductEnrichmentRunResult,
} from '@/types/product-enrichment';

export const DEFAULT_PRODUCT_ENRICHMENT_BATCH_SIZE = 10;
export const MAX_PRODUCT_ENRICHMENT_BATCH_SIZE = 20;

type ProductEnrichmentWriter = Pick<
  ProductEnrichmentRepository,
  'resolveCandidates' | 'writeBatch'
>;

const CONTENT_HASH_PATTERN = /^[a-f0-9]{64}$/;

export const hashProductImage = (input: Buffer) =>
  createHash('sha256').update(input).digest('hex');

export const buildProductEnrichmentImageKey = ({
  smaregiProductId,
  contentHash,
}: Pick<ProductEnrichmentCandidate, 'smaregiProductId'> & {
  contentHash: string;
}) => {
  if (!CONTENT_HASH_PATTERN.test(contentHash))
    throw new Error('Product image contentHash must be a SHA-256 hex digest.');
  if (!smaregiProductId.trim())
    throw new Error('A Smaregi product identity is required.');
  return `uploads/products/by-hash/${contentHash}.png`;
};

const validateCandidates = (candidates: ProductEnrichmentCandidate[]) => {
  const identities = new Set<string>();
  for (const candidate of candidates) {
    const identity = `${candidate.smaregiProductId}\u0000${candidate.productCode}`;
    if (identities.has(identity))
      throw new Error(
        `Duplicate product enrichment identity: ${candidate.productId}`,
      );
    identities.add(identity);
    if (
      !candidate.productId ||
      !candidate.smaregiProductId ||
      !candidate.productCode
    ) {
      throw new Error('Product enrichment identity fields are required.');
    }
    if (
      candidate.image &&
      !CONTENT_HASH_PATTERN.test(candidate.image.contentHash)
    )
      throw new Error(
        'Product image contentHash must be a SHA-256 hex digest.',
      );
    if (
      candidate.image &&
      !candidate.image.identityDecision.imageIdentityApproved
    )
      throw new Error(
        `Product image identity is not approved: ${candidate.productId}.`,
      );
    if (
      candidate.image &&
      (candidate.image.identityDecision.smaregiProductId !==
        candidate.smaregiProductId ||
        candidate.image.identityDecision.productCode !== candidate.productCode)
    )
      throw new Error(
        `Product image identity decision does not match: ${candidate.productId}.`,
      );
  }
};

export class ProductEnrichmentBatchService {
  public constructor(
    private readonly repository: ProductEnrichmentWriter = new ProductEnrichmentRepository(),
  ) {}

  public async apply(
    candidates: ProductEnrichmentCandidate[],
    batchSize = DEFAULT_PRODUCT_ENRICHMENT_BATCH_SIZE,
  ): Promise<ProductEnrichmentRunResult> {
    if (
      !Number.isInteger(batchSize) ||
      batchSize < 1 ||
      batchSize > MAX_PRODUCT_ENRICHMENT_BATCH_SIZE
    )
      throw new Error(
        `Product enrichment batchSize must be between 1 and ${MAX_PRODUCT_ENRICHMENT_BATCH_SIZE}.`,
      );
    validateCandidates(candidates);
    const resolved = await this.repository.resolveCandidates(candidates);
    resolved.sort((a, b) => a.productId.localeCompare(b.productId));
    const result: ProductEnrichmentRunResult = {
      batchesCommitted: 0,
      productsExamined: 0,
      productsUpdated: 0,
      fieldsFilled: 0,
      imagesCreated: 0,
    };
    for (let start = 0; start < resolved.length; start += batchSize) {
      const batch = resolved.slice(start, start + batchSize);
      const batchResult = await this.repository.writeBatch(batch);
      result.batchesCommitted += 1;
      result.productsExamined += batchResult.productsExamined;
      result.productsUpdated += batchResult.productsUpdated;
      result.fieldsFilled += batchResult.fieldsFilled;
      result.imagesCreated += batchResult.imagesCreated;
    }
    return result;
  }
}
