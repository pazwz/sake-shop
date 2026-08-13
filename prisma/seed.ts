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
    legacyTitles?: string[];
    description: string;
    season?: Season;
    displayOrder: number;
    productStart: number;
    productCount?: number;
    useMobileOverride?: boolean;
  }> = [
    {
      type: CollectionType.HERO,
      title: '春の便り',
      description:
        '季節の移ろいとともに、今だからこそ味わいたい一本をご紹介します。',
      displayOrder: 1,
      productStart: 0,
      useMobileOverride: true,
    },
    ...[
      [
        Season.SPRING,
        '春の便り',
        '花ひらく季節に似合う、軽やかで華やかな香りのお酒を集めました。',
        '春の特集',
      ],
      [
        Season.SUMMER,
        '夏の涼酒',
        '涼やかな口当たりと清々しい余韻を楽しむ、夏の一本をご紹介します。',
        '夏の特集',
      ],
      [
        Season.AUTUMN,
        '秋の深まり',
        '秋の夜に楽しむ、香り豊かで奥行きのある一本を集めました。',
        '秋の特集',
      ],
      [
        Season.WINTER,
        '冬の贈り物',
        '静かな冬の食卓を豊かにする、滋味深い味わいをご紹介します。',
        '冬の特集',
      ],
    ].map(([season, title, description, previousTitle], index) => ({
      type: CollectionType.SEASONAL,
      season: season as Season,
      title,
      description,
      legacyTitles: [previousTitle, `${season} collection`],
      displayOrder: index + 1,
      productStart: index * 2,
    })),
    {
      type: CollectionType.SHOPKEEPER,
      title: '店主のおすすめ',
      legacyTitles: ['店主のおすすめ 1'],
      description:
        '造り手の哲学と、食卓で過ごす時間まで想像しながら店主が選びました。',
      displayOrder: 1,
      productStart: 0,
      productCount: 5,
    },
    {
      type: CollectionType.GIFT,
      title: 'ギフトにおすすめ',
      legacyTitles: ['贈り物 1'],
      description:
        '大切な方へ気持ちを届ける、品格と物語を備えたお酒を集めました。',
      displayOrder: 1,
      productStart: 0,
      productCount: 5,
    },
    {
      type: CollectionType.EDITORIAL,
      title: '九州の風土',
      description:
        '水、土、気候、そして造り手。九州の風土から生まれる味わいを訪ねます。',
      displayOrder: 1,
      productStart: 0,
    },
    ...[
      [
        '酒と人の物語',
        '一本のお酒の向こう側にいる、造り手と土地の物語をご紹介します。',
      ],
      [
        '季節を味わう',
        '旬の料理とともに楽しみたい、季節の酒時間をご提案します。',
      ],
    ].map(([title, description], index) => ({
      type: CollectionType.STORY,
      title,
      description,
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
        title: collection.legacyTitles
          ? { in: [collection.title, ...collection.legacyTitles] }
          : collection.title,
      },
    });
    const collectionData = {
      type: collection.type,
      title: collection.title,
      description: collection.description,
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

    if (
      collection.type === CollectionType.EDITORIAL &&
      collection.title === '九州の風土'
    ) {
      const editorialSections = [
        {
          id: 'ceditorialkyushu0000000001',
          title: '水が描く、酒の輪郭',
          body: `山々に降った雨は、長い時間をかけて岩肌を通り、静かな仕込み水になります。\n\nやわらかな水が米の旨みをほどき、九州の酒に穏やかな丸みと、食卓に寄り添う余韻をもたらします。`,
          imageUrl:
            'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1400&q=85',
          productId: collectionProducts[0]?.id ?? null,
          displayOrder: 1,
        },
        {
          id: 'ceditorialkyushu0000000002',
          title: '土地を読む造り手',
          body: `気温や湿度、米の状態は毎年少しずつ異なります。造り手は数字だけに頼らず、香りや手触り、発酵の小さな音から、その日の仕事を選び取ります。\n\n積み重ねた記憶と細やかな判断が、一本ごとの個性を形づくっています。`,
          imageUrl:
            'https://images.unsplash.com/photo-1498654896293-37aacf113fd9?auto=format&fit=crop&w=1400&q=85',
          productId: collectionProducts[1]?.id ?? null,
          displayOrder: 2,
        },
        {
          id: 'ceditorialkyushu0000000003',
          title: '食卓で完成する味わい',
          body: `海と山の幸に恵まれた九州では、酒は料理とともに育まれてきました。豊かな旨みを受け止めながら、次のひと口を心地よく誘うこと。\n\n土地の料理と杯が重なるとき、その酒が持つ風景がいっそう鮮やかに立ち上がります。`,
          imageUrl:
            'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1400&q=85',
          productId: collectionProducts[0]?.id ?? null,
          displayOrder: 3,
        },
      ];

      for (const section of editorialSections) {
        await prisma.editorialSection.upsert({
          where: { id: section.id },
          update: { ...section, collectionId: saved.id },
          create: { ...section, collectionId: saved.id },
        });
      }
    }
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
