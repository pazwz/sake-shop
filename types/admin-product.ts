export type PublicationIssue = {
  code:
    | 'PRODUCT_INACTIVE'
    | 'PRICE_INVALID'
    | 'SLUG_MISSING'
    | 'SLUG_INVALID'
    | 'SLUG_DUPLICATE'
    | 'IMAGE_REQUIRED'
    | 'SYNC_SOURCE_INVALID';
  message: string;
};

export type PublicationWarning = {
  code: 'DESCRIPTION_RECOMMENDED' | 'OUT_OF_STOCK';
  message: string;
};

export type ProductPublicationResult = {
  canPublish: boolean;
  errors: PublicationIssue[];
  warnings: PublicationWarning[];
};

export type AdminProductInventory = {
  smaregiStoreId: string;
  quantity: number;
  lastSyncedAt: string;
};

export type AdminProductImage = {
  id: string;
  imageUrl: string;
  imageType: string;
  displayOrder: number;
  altText: string | null;
};

export type AdminProductRecord = {
  id: string;
  smaregiProductId: string;
  productCode: string;
  name: string;
  category: { id: string; name: string };
  price: number;
  taxRate: number;
  isActive: boolean;
  lastSyncedAt: string | null;
  source: 'smaregi' | 'local';
  slug: string;
  producer: string | null;
  origin: string | null;
  volume: string | null;
  alcoholPercentage: number | null;
  description: string | null;
  tastingNotes: string | null;
  isEcAvailable: boolean;
  images: AdminProductImage[];
  inventory: AdminProductInventory[];
  physicalTotalApproved: number;
  activeReservedQuantity: number;
  availableQuantity: number;
  publication: ProductPublicationResult;
};

export type AdminProductListResult = {
  items: AdminProductRecord[];
  categories: Array<{ id: string; name: string }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};
