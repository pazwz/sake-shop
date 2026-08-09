import { CollectionStatus, PrismaClient, Season } from '@prisma/client';
import { hash } from 'bcryptjs';
import {
  DEVELOPMENT_STORE_ID,
  developmentSeedAdmin,
  developmentSeedAdminAccessAccounts,
  developmentSeedAdminWithoutPassword,
  developmentSeedCategories,
  developmentSeedProducts,
  developmentSeedSubcategories,
} from '../config/seed';

const prisma = new PrismaClient();

const seed = async (): Promise<void> => {
  const passwordHash = process.env.ADMIN_SEED_PASSWORD
    ? await hash(process.env.ADMIN_SEED_PASSWORD, 12)
    : null;
  await prisma.adminUser.upsert({
    where: { email: developmentSeedAdmin.email },
    update: {
      ...developmentSeedAdmin,
      ...(passwordHash ? { passwordHash } : {}),
    },
    create: { ...developmentSeedAdmin, passwordHash },
  });
  for (const account of developmentSeedAdminAccessAccounts) {
    await prisma.adminUser.upsert({
      where: { email: account.email },
      update: { ...account, ...(passwordHash ? { passwordHash } : {}) },
      create: { ...account, passwordHash },
    });
  }
  await prisma.adminUser.upsert({
    where: { email: developmentSeedAdminWithoutPassword.email },
    update: { ...developmentSeedAdminWithoutPassword, passwordHash: null },
    create: { ...developmentSeedAdminWithoutPassword, passwordHash: null },
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

  const seededProducts = await prisma.product.findMany({
    where: { slug: { startsWith: 'dev-' } },
    take: 2,
    orderBy: { slug: 'asc' },
  });
  // Development-only CMS records for verifying the Sprint 7 home API.
  const collections = [
    ...['春の便り', '夏の涼酒', '秋の深まり'].map((title, index) => ({
      type: 'HERO' as const,
      title,
      displayOrder: index + 1,
    })),
    ...[Season.SPRING, Season.SUMMER, Season.AUTUMN, Season.WINTER].map(
      (season, index) => ({
        type: 'SEASONAL' as const,
        season,
        title: `${season} collection`,
        displayOrder: index + 1,
      }),
    ),
    ...['店主のおすすめ 1', '店主のおすすめ 2', '店主のおすすめ 3'].map(
      (title, index) => ({
        type: 'SHOPKEEPER' as const,
        title,
        displayOrder: index + 1,
      }),
    ),
    ...['贈り物 1', '贈り物 2', '贈り物 3'].map((title, index) => ({
      type: 'GIFT' as const,
      title,
      displayOrder: index + 1,
    })),
    ...['九州の風土', '食卓の余白', '蔵元を訪ねて'].map((title, index) => ({
      type: 'EDITORIAL' as const,
      title,
      displayOrder: index + 1,
    })),
    ...['酒と人の物語', '季節を味わう'].map((title, index) => ({
      type: 'STORY' as const,
      title,
      displayOrder: index + 1,
    })),
  ];
  for (const collection of collections) {
    const slug = `development-${collection.type.toLowerCase()}-${collection.title.replaceAll(' ', '-').replaceAll('　', '-')}`;
    const existing = await prisma.featuredCollection.findFirst({
      where: { title: collection.title, type: collection.type },
    });
    const saved = existing
      ? await prisma.featuredCollection.update({
          where: { id: existing.id },
          data: {
            ...collection,
            status: CollectionStatus.PUBLISHED,
            desktopImageUrl:
              'https://images.unsplash.com/photo-1527281400683-1aae777175f8?auto=format&fit=crop&w=1600&q=85',
            mobileImageUrl:
              'https://images.unsplash.com/photo-1527281400683-1aae777175f8?auto=format&fit=crop&w=900&q=85',
          },
        })
      : await prisma.featuredCollection.create({
          data: {
            ...collection,
            status: CollectionStatus.PUBLISHED,
            desktopImageUrl:
              'https://images.unsplash.com/photo-1527281400683-1aae777175f8?auto=format&fit=crop&w=1600&q=85',
            mobileImageUrl:
              'https://images.unsplash.com/photo-1527281400683-1aae777175f8?auto=format&fit=crop&w=900&q=85',
          },
        });
    await prisma.featuredCollectionProduct.deleteMany({
      where: { featuredCollectionId: saved.id },
    });
    await prisma.featuredCollectionProduct.createMany({
      data: seededProducts.map((product, index) => ({
        featuredCollectionId: saved.id,
        productId: product.id,
        displayOrder: index + 1,
      })),
    });
    void slug;
  }
};

seed()
  .catch(() => {
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
