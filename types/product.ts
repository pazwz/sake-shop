export interface ProductCategoryRecord {
  id: string;
  name: string;
  slug: string;
  parent: ProductCategoryRecord | null;
}

export interface ProductImageRecord {
  id: string;
  imageUrl: string;
  imageType: string;
  displayOrder: number;
  altText: string | null;
}

export interface ProductInventoryRecord {
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  lastSyncedAt: string;
}

export interface ProductRecord {
  id: string;
  slug: string;
  name: string;
  productCode: string;
  producer: string | null;
  origin: string | null;
  category: ProductCategoryRecord;
  price: number;
  taxRate: number;
  volume: string | null;
  alcoholPercentage: number | null;
  description: string | null;
  tastingNotes: string | null;
  images: ProductImageRecord[];
  inventory: ProductInventoryRecord[];
  physicalTotalApproved: number;
  store1Physical: number;
  activeReservedQuantity: number;
  availableQuantity: number;
  isEcAvailable: boolean;
  createdAt: string;
}

export interface ProductListResult {
  items: ProductRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CategoryRecord {
  id: string;
  name: string;
  slug: string;
  displayOrder: number;
  children: CategoryRecord[];
}
