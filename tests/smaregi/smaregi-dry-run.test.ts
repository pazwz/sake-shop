import assert from 'node:assert/strict';
import test from 'node:test';
import { MockSmaregiClient } from '@/services/smaregi/mock-smaregi-client';
import {
  LINXAS_PROTECTED_PRODUCT_FIELDS,
  SmaregiDryRunService,
} from '@/services/smaregi/smaregi-dry-run.service';
import { smaregiCategorySchema } from '@/types/smaregi';
import type { SmaregiDryRunSnapshot } from '@/types/smaregi-dry-run';

const emptySnapshot = (): SmaregiDryRunSnapshot => ({
  categories: [],
  products: [],
  inventory: [],
});

const repository = (snapshot: SmaregiDryRunSnapshot) => ({
  reads: 0,
  writes: 0,
  async getSnapshot() {
    this.reads += 1;
    return snapshot;
  },
  async create() {
    this.writes += 1;
    throw new Error('dry-run must not write');
  },
  async update() {
    this.writes += 1;
    throw new Error('dry-run must not write');
  },
  async upsert() {
    this.writes += 1;
    throw new Error('dry-run must not write');
  },
  async delete() {
    this.writes += 1;
    throw new Error('dry-run must not write');
  },
});

test('accepts the actual nullable Smaregi category sequence', () => {
  const parsed = smaregiCategorySchema.parse({
    categoryId: '8000001',
    categoryCode: 'TEST-EC',
    categoryName: 'TEST EC連携',
    parentCategoryId: null,
    displaySequence: null,
    displayFlag: '1',
    taxDivision: '0',
    reduceTaxId: null,
    insDateTime: '2026-08-26T21:53:07+09:00',
    updDateTime: '2026-08-26T21:53:07+09:00',
  });

  assert.equal(parsed.categoryId, '8000001');
  assert.equal(parsed.displaySequence, '0');
});

test('calculates category, product, and inventory differences without writes', async () => {
  const snapshot = emptySnapshot();
  snapshot.categories.push({
    id: 'local-category-10',
    smaregiCategoryId: '10',
    parentId: null,
    name: '旧カテゴリ',
    displayOrder: 1,
    isActive: true,
  });
  snapshot.products.push({
    id: 'local-product-100',
    smaregiProductId: '100',
    categoryId: 'local-category-10',
    productCode: 'OLD-100',
    name: '旧商品名',
    price: '1000.00',
    isActive: true,
  });
  snapshot.inventory.push({
    productId: 'local-product-100',
    smaregiStoreId: '1',
    quantity: 7,
    reservedQuantity: 3,
  });
  const database = repository(snapshot);
  const client = new MockSmaregiClient({
    stores: [{ storeId: '1' }],
    categories: [
      {
        categoryId: '10',
        categoryCode: 'SAKE',
        categoryName: '新カテゴリ',
        displaySequence: '2',
        displayFlag: '1',
        parentCategoryId: null,
        taxDivision: '0',
        reduceTaxId: null,
      },
      {
        categoryId: '20',
        categoryCode: 'WINE',
        categoryName: 'ワイン',
        displaySequence: '3',
        displayFlag: '1',
        parentCategoryId: '10',
        taxDivision: '0',
        reduceTaxId: null,
      },
    ],
    products: [
      {
        productId: '100',
        categoryId: '10',
        productCode: 'NEW-100',
        productName: '新商品名',
        price: '1200',
        displayFlag: '1',
        salesDivision: '0',
        division: '0',
        taxDivision: '0',
        useCategoryReduceTax: '1',
        reduceTaxId: null,
      },
      {
        productId: '9007199254740993123',
        categoryId: '20',
        productCode: 'NEW-200',
        productName: '新商品',
        price: '2500.00',
        displayFlag: '1',
        salesDivision: '0',
        division: '0',
        taxDivision: '0',
        useCategoryReduceTax: '1',
        reduceTaxId: null,
      },
    ],
    stock: [
      {
        storeId: '1',
        productId: '100',
        stockAmount: '5',
        layawayStockAmount: '2',
      },
    ],
    consumptionTaxRates: [
      {
        applyStartDate: '2019-10-01',
        taxRate: '10.000',
        taxRounding: '1',
      },
    ],
  });
  const service = new SmaregiDryRunService(client, database);

  const result = await service.dryRun();

  assert.equal(database.reads, 1);
  assert.equal(database.writes, 0);
  assert.deepEqual(
    result.categories.toUpdate[0].changes.map((change) => change.field),
    ['name', 'displayOrder'],
  );
  assert.equal(result.categories.toCreate[0].smaregiCategoryId, '20');
  assert.equal(result.categories.toCreate[0].parentSmaregiCategoryId, '10');
  assert.deepEqual(
    result.products.toUpdate[0].changes.map((change) => change.field),
    ['productCode', 'name', 'price'],
  );
  assert.equal(
    result.products.toCreate[0].smaregiProductId,
    '9007199254740993123',
  );
  assert.equal(result.products.toCreate[0].price, '2500');
  assert.equal(result.products.toCreate[0].resolvedTaxRate, '10.00');
  assert.equal(result.products.toCreate[0].priceMeaning, 'taxIncluded');
  assert.equal(result.inventory.toUpdate[0].quantity.after, 5);
  assert.equal(result.inventory.toUpdate[0].reservedQuantity.preserved, 3);
  assert.equal(result.inventory.toUpdate[0].layawayStockAmount, 2);
  assert.equal(
    result.inventory.toCreate[0].smaregiProductId,
    '9007199254740993123',
  );
  assert.equal(result.inventory.toCreate[0].quantity.after, 0);
  assert.equal(result.inventory.toCreate[0].layawayStockAmount, null);

  const productChangeFields = result.products.toUpdate.flatMap((product) =>
    product.changes.map((change) => change.field),
  );
  for (const protectedField of LINXAS_PROTECTED_PRODUCT_FIELDS) {
    assert.equal(productChangeFields.includes(protectedField), false);
  }
});

test('marks missing TEST-WINE-001 stock as an explicit zero', async () => {
  const snapshot: SmaregiDryRunSnapshot = {
    categories: [
      {
        id: 'category',
        smaregiCategoryId: '8000001',
        parentId: null,
        name: 'TEST EC連携',
        displayOrder: 0,
        isActive: true,
      },
    ],
    products: [
      {
        id: 'wine',
        smaregiProductId: '8000003',
        categoryId: 'category',
        productCode: 'TEST-WINE-001',
        name: 'TEST ワイン',
        price: '2500',
        isActive: true,
      },
    ],
    inventory: [
      {
        productId: 'wine',
        smaregiStoreId: '1',
        quantity: 4,
        reservedQuantity: 2,
      },
    ],
  };
  const client = new MockSmaregiClient({
    stores: [{ storeId: '1' }],
    categories: [
      {
        categoryId: '8000001',
        categoryCode: 'TEST-EC',
        categoryName: 'TEST EC連携',
        displaySequence: '0',
        displayFlag: '1',
        parentCategoryId: null,
        taxDivision: '0',
        reduceTaxId: null,
      },
    ],
    products: [
      {
        productId: '8000003',
        categoryId: '8000001',
        productCode: 'TEST-WINE-001',
        productName: 'TEST ワイン',
        price: '2500',
        displayFlag: '1',
        salesDivision: '0',
        division: '0',
        taxDivision: '0',
        useCategoryReduceTax: '1',
        reduceTaxId: null,
      },
    ],
    stock: [],
    consumptionTaxRates: [
      {
        applyStartDate: '2019-10-01',
        taxRate: '10.000',
        taxRounding: '1',
      },
    ],
  });

  const result = await new SmaregiDryRunService(
    client,
    repository(snapshot),
  ).dryRun();

  assert.equal(result.inventory.toZero.length, 1);
  assert.deepEqual(result.inventory.toZero[0].quantity, {
    before: 4,
    after: 0,
  });
  assert.equal(result.inventory.toZero[0].reservedQuantity.preserved, 2);
});

test('deactivates products only when the documented three flags do not match', async () => {
  const snapshot: SmaregiDryRunSnapshot = {
    categories: [
      {
        id: 'category',
        smaregiCategoryId: '10',
        parentId: null,
        name: '日本酒',
        displayOrder: 0,
        isActive: true,
      },
    ],
    products: [
      {
        id: 'product',
        smaregiProductId: '100',
        categoryId: 'category',
        productCode: 'P-100',
        name: '商品',
        price: '1000',
        isActive: true,
      },
    ],
    inventory: [],
  };
  const client = new MockSmaregiClient({
    categories: [
      {
        categoryId: '10',
        categoryCode: 'SAKE',
        categoryName: '日本酒',
        displaySequence: '0',
        displayFlag: '1',
        parentCategoryId: null,
        taxDivision: '0',
        reduceTaxId: null,
      },
    ],
    products: [
      {
        productId: '100',
        categoryId: '10',
        productCode: 'P-100',
        productName: '商品',
        price: '1000',
        displayFlag: '0',
        salesDivision: '0',
        division: '0',
        taxDivision: '0',
        useCategoryReduceTax: '1',
        reduceTaxId: null,
      },
    ],
    consumptionTaxRates: [
      {
        applyStartDate: '2019-10-01',
        taxRate: '10.000',
        taxRounding: '1',
      },
    ],
  });

  const result = await new SmaregiDryRunService(
    client,
    repository(snapshot),
  ).dryRun();

  assert.deepEqual(result.products.toDeactivate[0].changes, [
    { field: 'isActive', before: true, after: false },
  ]);
});

test('rejects malformed Smaregi price and stock amounts', async () => {
  const invalidPrice = new MockSmaregiClient({
    categories: [
      {
        categoryId: '1',
        categoryCode: 'TEST',
        categoryName: 'TEST',
        displaySequence: '0',
        displayFlag: '1',
        parentCategoryId: null,
        taxDivision: '0',
        reduceTaxId: null,
      },
    ],
    products: [
      {
        productId: '1',
        categoryId: '1',
        productCode: 'P-1',
        productName: '商品',
        price: '10.123',
        displayFlag: '1',
        salesDivision: '0',
        division: '0',
        taxDivision: '0',
        useCategoryReduceTax: '1',
        reduceTaxId: null,
      },
    ],
    consumptionTaxRates: [
      {
        applyStartDate: '2019-10-01',
        taxRate: '10.000',
        taxRounding: '1',
      },
    ],
  });
  const invalidPriceResult = await new SmaregiDryRunService(
    invalidPrice,
    repository(emptySnapshot()),
  ).dryRun();
  assert.equal(invalidPriceResult.products.blocked[0].code, 'INVALID_PRICE');

  const invalidStock = new MockSmaregiClient({
    stores: [{ storeId: '1' }],
    categories: [
      {
        categoryId: '1',
        categoryCode: 'TEST',
        categoryName: 'TEST',
        displaySequence: '0',
        displayFlag: '1',
        parentCategoryId: null,
        taxDivision: '0',
        reduceTaxId: null,
      },
    ],
    products: [
      {
        productId: '1',
        categoryId: '1',
        productCode: 'P-1',
        productName: '商品',
        price: '1000',
        displayFlag: '1',
        salesDivision: '0',
        division: '0',
        taxDivision: '0',
        useCategoryReduceTax: '1',
        reduceTaxId: null,
      },
    ],
    stock: [
      {
        storeId: '1',
        productId: '1',
        stockAmount: '1.5',
        layawayStockAmount: '0',
      },
    ],
    consumptionTaxRates: [
      {
        applyStartDate: '2019-10-01',
        taxRate: '10.000',
        taxRounding: '1',
      },
    ],
  });
  await assert.rejects(
    () =>
      new SmaregiDryRunService(
        invalidStock,
        repository(emptySnapshot()),
      ).dryRun(),
    { code: 'SMAREGI_DRY_RUN_VALIDATION_FAILED' },
  );
});

test('reports orphan and negative stock while keeping box products syncable', async () => {
  const client = new MockSmaregiClient({
    stores: [
      { storeId: '1', storeName: 'リンクサス福岡' },
      { storeId: '2', storeName: '倉庫４階' },
      { storeId: '3', storeName: '倉庫2階' },
      { storeId: '6', storeName: '別倉庫' },
      { storeId: '99', storeName: '未承認' },
    ],
    categories: [
      {
        categoryId: '8000014',
        categoryCode: '',
        categoryName: '箱',
        displaySequence: '0',
        displayFlag: '1',
        parentCategoryId: null,
        taxDivision: '0',
        reduceTaxId: null,
      },
    ],
    products: [
      {
        productId: '8000575',
        categoryId: '8000014',
        productCode: '49001777016324',
        productName: '響JH 箱代金',
        price: '1100',
        displayFlag: '1',
        salesDivision: '0',
        division: '0',
        taxDivision: '0',
        useCategoryReduceTax: '1',
        reduceTaxId: null,
      },
    ],
    stock: [
      {
        storeId: '2',
        productId: '8000575',
        stockAmount: '-20',
        layawayStockAmount: '0',
      },
      {
        storeId: '1',
        productId: 'deleted-product',
        stockAmount: '-1',
        layawayStockAmount: '0',
      },
      {
        storeId: '99',
        productId: 'unapproved-orphan',
        stockAmount: '-9',
        layawayStockAmount: '0',
      },
    ],
    consumptionTaxRates: [
      {
        applyStartDate: '2019-10-01',
        taxRate: '10.000',
        taxRounding: '1',
      },
    ],
  });

  const result = await new SmaregiDryRunService(
    client,
    repository(emptySnapshot()),
  ).dryRun();

  assert.deepEqual(
    result.storesUsed.map((store) => store.storeId),
    ['1', '2', '3', '6'],
  );
  assert.equal(result.products.toCreate[0].smaregiProductId, '8000575');
  assert.equal(result.inventory.toCreate.length, 4);
  assert.equal(
    result.inventory.toCreate.some(
      (item) => item.smaregiProductId === 'deleted-product',
    ),
    false,
  );
  assert.equal(result.anomalies.orphanStockCount, 1);
  assert.equal(
    result.anomalies.orphanStock[0].smaregiProductId,
    'deleted-product',
  );
  assert.equal(result.anomalies.negativeStockCount, 2);
  assert.equal(
    result.anomalies.negativeStock.find(
      (item) => item.smaregiProductId === '8000575',
    )?.specialProductKind,
    'BOX',
  );
});

test('defers only approved box products when category tax division is null', async () => {
  const client = new MockSmaregiClient({
    stores: [{ storeId: '1' }],
    categories: [
      {
        categoryId: '8000014',
        categoryCode: '',
        categoryName: '箱',
        displaySequence: '0',
        displayFlag: '1',
        parentCategoryId: null,
        taxDivision: null,
        reduceTaxId: null,
      },
    ],
    products: [
      {
        productId: '8000575',
        categoryId: '8000014',
        productCode: '49001777016324',
        productName: '響JH 箱代金',
        price: '1100',
        displayFlag: '1',
        salesDivision: '0',
        division: '0',
        taxDivision: '0',
        useCategoryReduceTax: '1',
        reduceTaxId: null,
      },
    ],
    consumptionTaxRates: [
      {
        applyStartDate: '2019-10-01',
        taxRate: '10.000',
        taxRounding: '1',
      },
    ],
  });

  const result = await new SmaregiDryRunService(
    client,
    repository(emptySnapshot()),
  ).dryRun();

  assert.deepEqual(result.products.approvedDeferredProducts, [
    {
      smaregiProductId: '8000575',
      productCode: '49001777016324',
      productName: '響JH 箱代金',
      code: 'CATEGORY_TAX_DIVISION_MISSING',
    },
  ]);
  assert.deepEqual(result.products.blocked, []);
  assert.equal(result.inventory.toCreate.length, 0);
});
