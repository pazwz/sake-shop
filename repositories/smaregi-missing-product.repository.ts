import { prisma } from '@/lib/prisma';

export type SmaregiMissingProductRecord = {
  id: string;
  smaregiProductId: string;
  productCode: string;
  name: string;
  categorySmaregiId: string | null;
  boxProductId: string | null;
  boxedProductId: string | null;
  imageUrls: string[];
  references: {
    orderItems: number;
    reservations: number;
    collections: number;
    editorialSections: number;
  };
};

export class SmaregiMissingProductRepository {
  public async findAbsentFromSource(
    sourceProductIds: readonly string[],
  ): Promise<SmaregiMissingProductRecord[]> {
    const products = await prisma.product.findMany({
      where: { smaregiProductId: { notIn: [...sourceProductIds] } },
      orderBy: { smaregiProductId: 'asc' },
      select: {
        id: true,
        smaregiProductId: true,
        productCode: true,
        name: true,
        category: { select: { smaregiCategoryId: true } },
        boxProductId: true,
        boxedProduct: { select: { id: true } },
        images: { select: { imageUrl: true } },
        _count: {
          select: {
            orderItems: true,
            inventoryReservations: true,
            featuredCollectionProducts: true,
            editorialSections: true,
          },
        },
      },
    });

    return products.map((product) => ({
      id: product.id,
      smaregiProductId: product.smaregiProductId,
      productCode: product.productCode,
      name: product.name,
      categorySmaregiId: product.category.smaregiCategoryId,
      boxProductId: product.boxProductId,
      boxedProductId: product.boxedProduct?.id ?? null,
      imageUrls: product.images.map((image) => image.imageUrl),
      references: {
        orderItems: product._count.orderItems,
        reservations: product._count.inventoryReservations,
        collections: product._count.featuredCollectionProducts,
        editorialSections: product._count.editorialSections,
      },
    }));
  }

  public async countImageUrlReferences(imageUrl: string) {
    const [products, desktopCollections, mobileCollections, editorial, labels] =
      await Promise.all([
        prisma.productImage.count({ where: { imageUrl } }),
        prisma.featuredCollection.count({
          where: { desktopImageUrl: imageUrl },
        }),
        prisma.featuredCollection.count({
          where: { mobileImageUrl: imageUrl },
        }),
        prisma.editorialSection.count({ where: { imageUrl } }),
        prisma.shipment.count({ where: { labelFileUrl: imageUrl } }),
      ]);
    return (
      products + desktopCollections + mobileCollections + editorial + labels
    );
  }
}
