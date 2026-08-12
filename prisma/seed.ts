import {
  CollectionStatus,
  CollectionType,
  PrismaClient,
  Season,
} from '@prisma/client';
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
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Development seed must not run in production.');
  }
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
    orderBy: { slug: 'asc' },
  });
  // Development-only CMS records mirror the fixed homepage areas. Historical
  // records may remain in an existing database, but are not required by seed.
  const collections: Array<{
    type: CollectionType;
    title: string;
    legacyTitle?: string;
    season?: Season;
    displayOrder: number;
    productStart: number;
    productCount?: number;
    useMobileOverride?: boolean;
  }> = [
    {
      type: CollectionType.HERO,
      title: '春の便り',
      displayOrder: 1,
      productStart: 0,
      useMobileOverride: true,
    },
    ...[
      [Season.SPRING, '春の特集'],
      [Season.SUMMER, '夏の特集'],
      [Season.AUTUMN, '秋の特集'],
      [Season.WINTER, '冬の特集'],
    ].map(([season, title], index) => ({
      type: CollectionType.SEASONAL,
      season: season as Season,
      title,
      legacyTitle: `${season} collection`,
      displayOrder: index + 1,
      productStart: index * 2,
    })),
    {
      type: CollectionType.SHOPKEEPER,
      title: '店主のおすすめ',
      legacyTitle: '店主のおすすめ 1',
      displayOrder: 1,
      productStart: 0,
      productCount: 3,
    },
    {
      type: CollectionType.GIFT,
      title: 'ギフトにおすすめ',
      legacyTitle: '贈り物 1',
      displayOrder: 1,
      productStart: 0,
      productCount: 3,
    },
    {
      type: CollectionType.EDITORIAL,
      title: '九州の風土',
      displayOrder: 1,
      productStart: 0,
    },
    ...['酒と人の物語', '季節を味わう'].map((title, index) => ({
      type: CollectionType.STORY,
      title,
      displayOrder: index + 1,
      productStart: index * 2,
    })),
  ];

  for (const collection of collections) {
    const collectionProducts = seededProducts.slice(
      collection.productStart,
      collection.productStart + (collection.productCount ?? 2),
    );
    const existing = await prisma.featuredCollection.findFirst({
      where: {
        type: collection.type,
        title: collection.legacyTitle
          ? { in: [collection.title, collection.legacyTitle] }
          : collection.title,
      },
    });
    const collectionData = {
      type: collection.type,
      title: collection.title,
      season: collection.season,
      displayOrder: collection.displayOrder,
    };
    const saved = existing
      ? await prisma.featuredCollection.update({
          where: { id: existing.id },
          data: {
            ...collectionData,
            status: CollectionStatus.PUBLISHED,
            publishStartAt: null,
            publishEndAt: null,
            desktopImageUrl:
              'https://images.unsplash.com/photo-1527281400683-1aae777175f8?auto=format&fit=crop&w=1600&q=85',
            mobileImageUrl: collection.useMobileOverride
              ? 'https://images.unsplash.com/photo-1527281400683-1aae777175f8?auto=format&fit=crop&w=900&q=85'
              : null,
          },
        })
      : await prisma.featuredCollection.create({
          data: {
            ...collectionData,
            status: CollectionStatus.PUBLISHED,
            publishStartAt: null,
            publishEndAt: null,
            desktopImageUrl:
              'https://images.unsplash.com/photo-1527281400683-1aae777175f8?auto=format&fit=crop&w=1600&q=85',
            mobileImageUrl: collection.useMobileOverride
              ? 'https://images.unsplash.com/photo-1527281400683-1aae777175f8?auto=format&fit=crop&w=900&q=85'
              : null,
          },
        });
    await prisma.featuredCollectionProduct.deleteMany({
      where: { featuredCollectionId: saved.id },
    });
    await prisma.featuredCollectionProduct.createMany({
      data: collectionProducts.map((product, index) => ({
        featuredCollectionId: saved.id,
        productId: product.id,
        displayOrder: index + 1,
      })),
    });
  }

  // Retire only the exact legacy development fixtures. No record is deleted,
  // and production execution is blocked above.
  await prisma.featuredCollection.updateMany({
    where: {
      OR: [
        {
          type: CollectionType.SHOPKEEPER,
          title: { in: ['店主のおすすめ 2', '店主のおすすめ 3'] },
        },
        {
          type: CollectionType.GIFT,
          title: { in: ['贈り物 2', '贈り物 3'] },
        },
        {
          type: CollectionType.HERO,
          title: { in: ['夏の涼酒', '秋の深まり'] },
        },
        {
          type: CollectionType.EDITORIAL,
          title: { in: ['食卓の余白', '蔵元を訪ねて'] },
        },
      ],
    },
    data: { status: CollectionStatus.ARCHIVED },
  });
};

seed()
  .catch(() => {
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
