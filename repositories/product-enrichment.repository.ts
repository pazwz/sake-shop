import { Prisma, type PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type {
  ProductEnrichmentBatchResult,
  ProductEnrichmentCandidate,
} from '@/types/product-enrichment';

type EnrichmentDatabase = Pick<PrismaClient, '$transaction'> & {
  product: PrismaClient['product'];
};

const stringFields = [
  'producer',
  'origin',
  'volume',
  'description',
  'tastingNotes',
] as const;

const isBlank = (value: string | null) => value === null || value.trim() === '';

const hasContentHash = (imageUrl: string, contentHash: string) =>
  imageUrl.toLowerCase().includes(contentHash.toLowerCase());

export class ProductEnrichmentIdentityError extends Error {
  public constructor(productId: string) {
    super(`Product enrichment identity changed for ${productId}.`);
    this.name = 'ProductEnrichmentIdentityError';
  }
}

export class ProductEnrichmentRepository {
  public constructor(private readonly database: EnrichmentDatabase = prisma) {}

  public async resolveCandidates(candidates: ProductEnrichmentCandidate[]) {
    const products = await this.database.product.findMany({
      where: {
        smaregiProductId: {
          in: candidates.map(({ smaregiProductId }) => smaregiProductId),
        },
      },
      select: {
        id: true,
        smaregiProductId: true,
        productCode: true,
      },
    });
    const bySmaregiId = new Map(
      products.map((product) => [product.smaregiProductId, product]),
    );
    return candidates.map((candidate) => {
      const product = bySmaregiId.get(candidate.smaregiProductId);
      if (!product || product.productCode !== candidate.productCode)
        throw new ProductEnrichmentIdentityError(candidate.productId);
      if (candidate.productId && candidate.productId !== product.id)
        throw new ProductEnrichmentIdentityError(candidate.productId);
      return { ...candidate, productId: product.id };
    });
  }

  public writeBatch(
    candidates: ProductEnrichmentCandidate[],
  ): Promise<ProductEnrichmentBatchResult> {
    return this.database.$transaction(async (transaction) => {
      const current = await transaction.product.findMany({
        where: { id: { in: candidates.map(({ productId }) => productId) } },
        select: {
          id: true,
          smaregiProductId: true,
          productCode: true,
          producer: true,
          origin: true,
          volume: true,
          alcoholPercentage: true,
          description: true,
          tastingNotes: true,
          images: {
            select: { imageUrl: true, displayOrder: true },
            orderBy: { displayOrder: 'desc' },
          },
        },
      });
      const currentById = new Map(
        current.map((product) => [product.id, product]),
      );
      const result: ProductEnrichmentBatchResult = {
        productsExamined: candidates.length,
        productsUpdated: 0,
        fieldsFilled: 0,
        imagesCreated: 0,
      };

      for (const candidate of candidates) {
        const product = currentById.get(candidate.productId);
        if (
          !product ||
          product.smaregiProductId !== candidate.smaregiProductId ||
          product.productCode !== candidate.productCode
        ) {
          throw new ProductEnrichmentIdentityError(candidate.productId);
        }

        const data: Prisma.ProductUpdateInput = {};
        for (const field of stringFields) {
          const proposed = candidate.fields[field]?.trim();
          if (proposed && isBlank(product[field])) data[field] = proposed;
        }
        if (
          candidate.fields.alcoholPercentage !== undefined &&
          product.alcoholPercentage === null
        ) {
          data.alcoholPercentage = candidate.fields.alcoholPercentage;
        }
        const fieldsFilled = Object.keys(data).length;
        if (fieldsFilled > 0) {
          await transaction.product.update({
            where: { id: product.id },
            data,
          });
          result.productsUpdated += 1;
          result.fieldsFilled += fieldsFilled;
        }

        const image = candidate.image;
        if (
          image &&
          !product.images.some(({ imageUrl }) =>
            hasContentHash(imageUrl, image.contentHash),
          )
        ) {
          await transaction.productImage.create({
            data: {
              productId: product.id,
              imageUrl: image.imageUrl,
              imageType: 'PRODUCT',
              displayOrder: (product.images[0]?.displayOrder ?? 0) + 1,
              altText: image.altText ?? null,
            },
          });
          result.imagesCreated += 1;
        }
      }
      return result;
    });
  }
}
