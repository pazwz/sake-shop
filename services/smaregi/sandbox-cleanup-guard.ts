const expectedProducts = new Map([
  [
    '8000001',
    {
      productCode: 'TEST-SAKE-001',
      name: 'TEST 日本酒',
      slug: 'smaregi-product-test-sake-001',
      quantity: 5,
    },
  ],
  [
    '8000002',
    {
      productCode: 'TEST-WHISKY-001',
      name: 'TEST ウイスキー',
      slug: 'smaregi-product-test-whisky-001',
      quantity: 2,
    },
  ],
  [
    '8000003',
    {
      productCode: 'TEST-WINE-001',
      name: 'TEST ワイン',
      slug: 'smaregi-product-test-wine-001',
      quantity: 0,
    },
  ],
]);

export const SANDBOX_TEST_PRODUCT_IDS = [...expectedProducts.keys()];

export type SandboxCleanupCandidate = {
  category: {
    id: string;
    smaregiCategoryId: string | null;
    name: string;
    slug: string;
    productCount: number;
  } | null;
  products: Array<{
    id: string;
    smaregiProductId: string;
    categoryId: string;
    productCode: string;
    name: string;
    slug: string;
    isEcAvailable: boolean;
  }>;
  inventory: Array<{
    productId: string;
    smaregiStoreId: string;
    quantity: number;
    reservedQuantity: number;
    availableQuantity: number;
  }>;
  dependencyCount: number;
};

export const validateSandboxCleanupCandidate = (
  candidate: SandboxCleanupCandidate,
) => {
  const category = candidate.category;
  if (
    !category ||
    category.smaregiCategoryId !== '8000001' ||
    category.name !== 'EST EC連携' ||
    category.slug !== 'smaregi-category-test-ec' ||
    category.productCount !== 3
  )
    throw new Error('Sandbox cleanup category guard failed.');
  if (candidate.products.length !== expectedProducts.size)
    throw new Error('Sandbox cleanup product count guard failed.');
  if (candidate.inventory.length !== expectedProducts.size)
    throw new Error('Sandbox cleanup inventory count guard failed.');
  if (candidate.dependencyCount !== 0)
    throw new Error('Sandbox cleanup dependency guard failed.');

  for (const product of candidate.products) {
    const expected = expectedProducts.get(product.smaregiProductId);
    if (
      !expected ||
      product.categoryId !== category.id ||
      product.productCode !== expected.productCode ||
      product.name !== expected.name ||
      product.slug !== expected.slug ||
      product.isEcAvailable
    )
      throw new Error(
        `Sandbox cleanup product guard failed for ${product.smaregiProductId}.`,
      );
    const inventory = candidate.inventory.find(
      (item) => item.productId === product.id,
    );
    if (
      !inventory ||
      inventory.smaregiStoreId !== '1' ||
      inventory.quantity !== expected.quantity ||
      inventory.reservedQuantity !== 0 ||
      inventory.availableQuantity !== expected.quantity
    )
      throw new Error(
        `Sandbox cleanup inventory guard failed for ${product.smaregiProductId}.`,
      );
  }

  return {
    categoryId: category.id,
    productIds: candidate.products.map((product) => product.id),
  };
};
