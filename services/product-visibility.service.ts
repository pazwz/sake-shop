import {
  SMAREGI_BOX_CATEGORY_ID,
  SMAREGI_PACKAGE_ONLY_PRODUCT_IDS,
} from '@/config/box-products';

type ProductIdentity = {
  smaregiProductId: string;
  category: { smaregiCategoryId: string | null };
};

const packageOnlyIds = new Set<string>(SMAREGI_PACKAGE_ONLY_PRODUCT_IDS);

export const isPackageOnlyProduct = (product: ProductIdentity) =>
  packageOnlyIds.has(product.smaregiProductId) ||
  product.category.smaregiCategoryId === SMAREGI_BOX_CATEGORY_ID;

export const isStandaloneEcProduct = (product: ProductIdentity) =>
  !isPackageOnlyProduct(product);
