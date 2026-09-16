export type DryRunValue = string | number | boolean | null;

export type DryRunFieldChange = {
  field: string;
  before: DryRunValue;
  after: DryRunValue;
};

export type SmaregiDryRunCategoryCreate = {
  smaregiCategoryId: string;
  categoryCode: string;
  name: string;
  suggestedSlug: string;
  parentSmaregiCategoryId: string | null;
  displayOrder: number;
  isActive: boolean;
};

export type SmaregiDryRunCategoryChange = {
  smaregiCategoryId: string;
  changes: DryRunFieldChange[];
};

export type SmaregiDryRunProductCreate = {
  smaregiProductId: string;
  productCode: string;
  name: string;
  suggestedSlug: string;
  categorySmaregiCategoryId: string;
  price: string;
  isActive: boolean;
  taxDivision: '0';
  resolvedTaxRate: string;
  priceMeaning: 'taxIncluded';
  taxResolutionSource:
    | 'category.standard'
    | 'category.reduced'
    | 'product.standard'
    | 'product.reduced';
};

export type SmaregiDryRunProductChange = {
  smaregiProductId: string;
  productCode: string;
  changes: DryRunFieldChange[];
  taxDivision: '0';
  resolvedTaxRate: string;
  priceMeaning: 'taxIncluded';
  taxResolutionSource:
    | 'category.standard'
    | 'category.reduced'
    | 'product.standard'
    | 'product.reduced';
};

export type SmaregiDryRunInventoryChange = {
  smaregiProductId: string;
  productCode: string;
  storeId: string;
  quantity: {
    before: number | null;
    after: number;
  };
  reservedQuantity: {
    preserved: number;
  };
  layawayStockAmount: number | null;
};

export type SmaregiStockAnomaly = {
  smaregiProductId: string;
  productCode: string | null;
  productName: string | null;
  storeId: string;
  storeName: string | null;
  rawStockAmount: number;
  isOrphan: boolean;
  specialProductKind: 'BOX' | null;
};

export type SmaregiDryRunResult = {
  storesUsed: Array<{ storeId: string; storeName: string | null }>;
  anomalies: {
    missingApprovedStoreIds: string[];
    orphanStockCount: number;
    orphanStock: SmaregiStockAnomaly[];
    negativeStockCount: number;
    negativeStock: SmaregiStockAnomaly[];
  };
  categories: {
    toCreate: SmaregiDryRunCategoryCreate[];
    toUpdate: SmaregiDryRunCategoryChange[];
    unchanged: Array<{ smaregiCategoryId: string }>;
    toDeactivate: SmaregiDryRunCategoryChange[];
  };
  products: {
    toCreate: SmaregiDryRunProductCreate[];
    toUpdate: SmaregiDryRunProductChange[];
    unchanged: Array<
      {
        smaregiProductId: string;
        productCode: string;
      } & Omit<
        SmaregiDryRunProductCreate,
        | 'smaregiProductId'
        | 'productCode'
        | 'name'
        | 'suggestedSlug'
        | 'categorySmaregiCategoryId'
        | 'price'
        | 'isActive'
      >
    >;
    toDeactivate: SmaregiDryRunProductChange[];
    approvedDeferredProducts: Array<{
      smaregiProductId: string;
      productCode: string;
      productName: string;
      code: 'CATEGORY_TAX_DIVISION_MISSING';
    }>;
    blocked: Array<{
      smaregiProductId: string;
      productCode: string;
      code: string;
    }>;
  };
  inventory: {
    toCreate: SmaregiDryRunInventoryChange[];
    toUpdate: SmaregiDryRunInventoryChange[];
    toZero: SmaregiDryRunInventoryChange[];
    unchanged: Array<{
      smaregiProductId: string;
      productCode: string;
      storeId: string;
      quantity: number;
      reservedQuantity: number;
      layawayStockAmount: number | null;
    }>;
  };
};

export type SmaregiDryRunSnapshot = {
  categories: Array<{
    id: string;
    smaregiCategoryId: string | null;
    parentId: string | null;
    name: string;
    displayOrder: number;
    isActive: boolean;
  }>;
  products: Array<{
    id: string;
    smaregiProductId: string;
    categoryId: string;
    productCode: string;
    name: string;
    price: string;
    isActive: boolean;
  }>;
  inventory: Array<{
    productId: string;
    smaregiStoreId: string;
    quantity: number;
    reservedQuantity: number;
  }>;
};
