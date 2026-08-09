import { PrismaClient } from '@prisma/client';
import {
  DEVELOPMENT_STORE_ID,
  developmentSeedAdmin,
  developmentSeedCategories,
  developmentSeedProducts,
  developmentSeedSubcategories,
} from '../config/seed';

const prisma = new PrismaClient();

const seed = async (): Promise<void> => {
  await prisma.adminUser.upsert({
    where: { email: developmentSeedAdmin.email },
    update: developmentSeedAdmin,
    create: developmentSeedAdmin,
  });

  for (const category of developmentSeedCategories) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: category,
      create: category,
    });
  }

  for (const subcategory of developmentSeedSubcategories) {
    const parent = await prisma.category.findUniqueOrThrow({
      where: { slug: subcategory.parentSlug },
    });
    const { parentSlug, ...categoryData } = subcategory;

    await prisma.category.upsert({
      where: { slug: categoryData.slug },
      update: { ...categoryData, parentId: parent.id },
      create: { ...categoryData, parentId: parent.id },
    });
  }

  for (const product of developmentSeedProducts) {
    const category = await prisma.category.findUniqueOrThrow({
      where: { slug: product.categorySlug },
    });
    const {
      categorySlug,
      imageUrl,
      quantity,
      reservedQuantity,
      ...productData
    } = product;
    const availableQuantity = quantity - reservedQuantity;
    const seededProduct = await prisma.product.upsert({
      where: { slug: product.slug },
      update: {
        ...productData,
        categoryId: category.id,
        isActive: true,
        isEcAvailable: true,
      },
      create: {
        ...productData,
        categoryId: category.id,
        isActive: true,
        isEcAvailable: true,
      },
    });

    await prisma.productImage.deleteMany({
      where: { productId: seededProduct.id },
    });
    await prisma.productImage.create({
      data: {
        productId: seededProduct.id,
        imageUrl,
        imageType: 'development-seed',
        displayOrder: 1,
        altText: seededProduct.name,
      },
    });
    await prisma.inventoryMirror.upsert({
      where: {
        productId_smaregiStoreId: {
          productId: seededProduct.id,
          smaregiStoreId: DEVELOPMENT_STORE_ID,
        },
      },
      update: {
        quantity,
        reservedQuantity,
        availableQuantity,
        lastSyncedAt: new Date(),
      },
      create: {
        productId: seededProduct.id,
        smaregiStoreId: DEVELOPMENT_STORE_ID,
        quantity,
        reservedQuantity,
        availableQuantity,
        lastSyncedAt: new Date(),
      },
    });
  }
};

seed()
  .catch(() => {
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
