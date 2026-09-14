import type {
  SmaregiApiClient,
  SmaregiCategory,
  SmaregiConsumptionTaxRate,
  SmaregiProduct,
  SmaregiReduceTaxRate,
  SmaregiStock,
  SmaregiStore,
} from '@/types/smaregi';

export class MockSmaregiClient implements SmaregiApiClient {
  public readonly retryCount = 0;

  public constructor(
    private readonly data: {
      stores?: SmaregiStore[];
      categories?: SmaregiCategory[];
      products?: SmaregiProduct[];
      stock?: SmaregiStock[];
      consumptionTaxRates?: SmaregiConsumptionTaxRate[];
      reduceTaxRates?: SmaregiReduceTaxRate[];
    } = {},
  ) {}

  public async getStores() {
    return this.data.stores ?? [];
  }

  public async getCategories() {
    return this.data.categories ?? [];
  }

  public async getProducts() {
    return this.data.products ?? [];
  }

  public async getProductsSnapshot() {
    const products = this.data.products ?? [];
    return {
      products,
      sourceIdentityCount: new Set(products.map((product) => product.productId))
        .size,
      pagesFetched: 1,
      pageSize: 1000,
      complete: true as const,
    };
  }

  public async getStock(storeId: string) {
    return (this.data.stock ?? []).filter((item) => item.storeId === storeId);
  }

  public async getConsumptionTaxRates() {
    return this.data.consumptionTaxRates ?? [];
  }

  public async getReduceTaxRates() {
    return this.data.reduceTaxRates ?? [];
  }
}
