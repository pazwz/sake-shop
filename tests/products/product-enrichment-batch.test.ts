import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildProductEnrichmentImageKey,
  ProductEnrichmentBatchService,
} from '@/services/product-enrichment-batch.service';
import type {
  ProductEnrichmentBatchResult,
  ProductEnrichmentCandidate,
} from '@/types/product-enrichment';
import type { ProductImageIdentityDecision } from '@/types/product-identity';

const hash = 'a'.repeat(64);
const approvedIdentity: ProductImageIdentityDecision = {
  smaregiProductId: 'smaregi-1',
  productCode: 'CODE-1',
  identityType: 'STANDARD_SPIRIT',
  identityConfirmed: true,
  imageIdentityApproved: true,
  approved: true,
  score: 100,
  requiredFields: ['brand', 'product'],
  matchedFields: ['brand', 'product', 'productCode'],
  unknownRequiredFields: [],
  hardConflicts: [],
  rejectionReason: null,
  matches: {
    brandMatch: 'STRONG_MATCH',
    productMatch: 'STRONG_MATCH',
    vintageMatch: 'UNKNOWN',
    ageMatch: 'UNKNOWN',
    batchMatch: 'UNKNOWN',
    editionMatch: 'UNKNOWN',
    variantMatch: 'UNKNOWN',
    volumeMatch: 'UNKNOWN',
    packageMatch: 'UNKNOWN',
    productCodeMatch: 'STRONG_MATCH',
    producerMatch: 'UNKNOWN',
  },
  evaluatedAt: '2026-09-11T00:00:00.000Z',
};

const candidate = (index: number): ProductEnrichmentCandidate => ({
  productId: `local-${String(index).padStart(2, '0')}`,
  smaregiProductId: `smaregi-${index}`,
  productCode: `CODE-${index}`,
  fields: { producer: `Producer ${index}` },
  image: {
    imageUrl: `https://cdn.example/uploads/products/smaregi-${index}/${hash}.png`,
    contentHash: hash,
    identityDecision: {
      ...approvedIdentity,
      smaregiProductId: `smaregi-${index}`,
      productCode: `CODE-${index}`,
    },
  },
});

class InMemoryWriter {
  public readonly committed: string[][] = [];
  private readonly populated = new Set<string>();
  private readonly images = new Set<string>();
  public failProductId: string | null = null;

  public async resolveCandidates(candidates: ProductEnrichmentCandidate[]) {
    return candidates;
  }

  public async writeBatch(candidates: ProductEnrichmentCandidate[]) {
    const nextPopulated = new Set(this.populated);
    const nextImages = new Set(this.images);
    const result: ProductEnrichmentBatchResult = {
      productsExamined: candidates.length,
      productsUpdated: 0,
      fieldsFilled: 0,
      imagesCreated: 0,
    };
    for (const item of candidates) {
      if (!nextPopulated.has(item.productId)) {
        nextPopulated.add(item.productId);
        result.productsUpdated += 1;
        result.fieldsFilled += 1;
      }
      const imageIdentity = item.image
        ? `${item.productId}:${item.image.contentHash}`
        : null;
      if (imageIdentity && !nextImages.has(imageIdentity)) {
        nextImages.add(imageIdentity);
        result.imagesCreated += 1;
      }
      if (item.productId === this.failProductId)
        throw new Error('simulated mid-batch rollback');
    }
    this.populated.clear();
    nextPopulated.forEach((value) => this.populated.add(value));
    this.images.clear();
    nextImages.forEach((value) => this.images.add(value));
    this.committed.push(candidates.map(({ productId }) => productId));
    return result;
  }
}

test('writes stable short batches and is idempotent on retry', async () => {
  const writer = new InMemoryWriter();
  const service = new ProductEnrichmentBatchService(writer);
  const input = [candidate(3), candidate(1), candidate(2)];
  const first = await service.apply(input, 2);
  assert.deepEqual(writer.committed.slice(0, 2), [
    ['local-01', 'local-02'],
    ['local-03'],
  ]);
  assert.equal(first.batchesCommitted, 2);
  assert.equal(first.productsUpdated, 3);
  assert.equal(first.imagesCreated, 3);

  const retry = await service.apply(input, 2);
  assert.equal(retry.productsUpdated, 0);
  assert.equal(retry.imagesCreated, 0);
});

test('a mid-batch failure rolls back that batch and a retry stays idempotent', async () => {
  const writer = new InMemoryWriter();
  writer.failProductId = 'local-04';
  const service = new ProductEnrichmentBatchService(writer);
  const input = [candidate(1), candidate(2), candidate(3), candidate(4)];
  await assert.rejects(service.apply(input, 2));
  assert.deepEqual(writer.committed, [['local-01', 'local-02']]);

  writer.failProductId = null;
  const retry = await service.apply(input, 2);
  assert.equal(retry.productsUpdated, 2);
  assert.equal(retry.imagesCreated, 2);
  assert.deepEqual(writer.committed, [
    ['local-01', 'local-02'],
    ['local-01', 'local-02'],
    ['local-03', 'local-04'],
  ]);
});

test('uses content-addressed product image keys', () => {
  assert.equal(
    buildProductEnrichmentImageKey({
      smaregiProductId: '8000001',
      contentHash: hash,
    }),
    `uploads/products/by-hash/${hash}.png`,
  );
  assert.throws(() =>
    buildProductEnrichmentImageKey({
      smaregiProductId: '8000001',
      contentHash: 'not-a-hash',
    }),
  );
});

test('rejects an image whose identity decision is not approved', async () => {
  const writer = new InMemoryWriter();
  const service = new ProductEnrichmentBatchService(writer);
  const input = candidate(1);
  input.image = {
    ...input.image!,
    identityDecision: {
      ...approvedIdentity,
      identityConfirmed: false,
      imageIdentityApproved: false,
      approved: false,
      rejectionReason: 'IDENTITY_EVIDENCE_INSUFFICIENT',
    },
  };

  await assert.rejects(
    service.apply([input]),
    /Product image identity is not approved/,
  );
  assert.deepEqual(writer.committed, []);
});

test('rejects an approved identity decision copied from another product', async () => {
  const writer = new InMemoryWriter();
  const service = new ProductEnrichmentBatchService(writer);
  const input = candidate(2);
  input.image = {
    ...input.image!,
    identityDecision: approvedIdentity,
  };

  await assert.rejects(
    service.apply([input]),
    /Product image identity decision does not match/,
  );
  assert.deepEqual(writer.committed, []);
});
