import {
  Prisma,
  SmaregiProductExclusionReason,
} from '@prisma/client';
import { prisma } from '@/lib/prisma';

export type SmaregiProductExclusionRecord = {
  id: string;
  smaregiProductId: string;
  productCode: string | null;
  productNameSnapshot: string | null;
  reason: SmaregiProductExclusionReason;
  createdAt: Date;
  revokedAt: Date | null;
};

export type SmaregiProductExclusionApplyResult = {
  exclusion: SmaregiProductExclusionRecord;
  localOutcome: 'DELETED' | 'RETIRED';
  deletedImages: Array<{
    productId: string;
    smaregiProductId: string;
    imageUrl: string;
  }>;
  product: {
    id: string;
    smaregiProductId: string;
    productCode: string;
    name: string;
  } | null;
};

const productSelect = {
  id: true,
  smaregiProductId: true,
  productCode: true,
  name: true,
  lastSyncedAt: true,
  images: { select: { imageUrl: true } },
  boxProductId: true,
  boxedProduct: { select: { id: true } },
  _count: {
    select: {
      orderItems: true,
      inventoryReservations: true,
      featuredCollectionProducts: true,
      editorialSections: true,
    },
  },
} satisfies Prisma.ProductSelect;

type Database = Pick<typeof prisma, '$transaction'>;

export class SmaregiProductExclusionRepository {
  public constructor(private readonly database: Database = prisma) {}

  public async findActiveSmaregiProductIds() {
    const items = await prisma.smaregiProductExclusion.findMany({
      where: { revokedAt: null },
      select: { smaregiProductId: true },
    });
    return new Set(items.map((item) => item.smaregiProductId));
  }

  public findActive(limit = 100) {
    return prisma.smaregiProductExclusion.findMany({
      where: { revokedAt: null },
      orderBy: [{ createdAt: 'desc' }, { smaregiProductId: 'asc' }],
      take: limit,
      select: {
        id: true,
        smaregiProductId: true,
        productCode: true,
        productNameSnapshot: true,
        reason: true,
        createdAt: true,
        revokedAt: true,
      },
    });
  }

  public async applyForProduct(productId: string, createdById: string) {
    return this.database.$transaction(async (transaction) => {
      const product = await transaction.product.findUnique({
        where: { id: productId },
        select: productSelect,
      });
      if (!product) return null;
      if (!product.lastSyncedAt) return { unsupported: true as const };

      const exclusion = await transaction.smaregiProductExclusion.upsert({
        where: { smaregiProductId: product.smaregiProductId },
        create: {
          smaregiProductId: product.smaregiProductId,
          productCode: product.productCode,
          productNameSnapshot: product.name,
          reason: SmaregiProductExclusionReason.OFFLINE_ONLY,
          createdById,
        },
        update: {
          productCode: product.productCode,
          productNameSnapshot: product.name,
          reason: SmaregiProductExclusionReason.OFFLINE_ONLY,
          createdById,
          revokedAt: null,
        },
        select: {
          id: true,
          smaregiProductId: true,
          productCode: true,
          productNameSnapshot: true,
          reason: true,
          createdAt: true,
          revokedAt: true,
        },
      });

      const references = product._count;
      const mustRetire =
        references.orderItems > 0 ||
        references.inventoryReservations > 0 ||
        references.featuredCollectionProducts > 0 ||
        references.editorialSections > 0 ||
        Boolean(product.boxProductId) ||
        Boolean(product.boxedProduct);
      if (mustRetire) {
        await transaction.product.update({
          where: { id: product.id },
          data: { isActive: false, isEcAvailable: false },
        });
        return {
          exclusion,
          localOutcome: 'RETIRED' as const,
          deletedImages: [],
          product: this.productIdentity(product),
        };
      }

      const deletedImages = product.images.map(({ imageUrl }) => ({
        productId: product.id,
        smaregiProductId: product.smaregiProductId,
        imageUrl,
      }));
      await transaction.productImage.deleteMany({ where: { productId: product.id } });
      await transaction.inventoryMirror.deleteMany({ where: { productId: product.id } });
      await transaction.product.delete({ where: { id: product.id } });
      return {
          exclusion,
          localOutcome: 'DELETED' as const,
          deletedImages,
          product: this.productIdentity(product),
      };
    });
  }

  public async revoke(smaregiProductId: string) {
    return prisma.smaregiProductExclusion.update({
      where: { smaregiProductId },
      data: { revokedAt: new Date() },
      select: {
        id: true,
        smaregiProductId: true,
        productCode: true,
        productNameSnapshot: true,
        reason: true,
        createdAt: true,
        revokedAt: true,
      },
    });
  }

  private productIdentity(
    product: Prisma.ProductGetPayload<{ select: typeof productSelect }>,
  ) {
    return {
      id: product.id,
      smaregiProductId: product.smaregiProductId,
      productCode: product.productCode,
      name: product.name,
    };
  }
}
