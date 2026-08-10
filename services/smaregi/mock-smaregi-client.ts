import type {
  SmaregiApiClient,
  SmaregiCategory,
  SmaregiProduct,
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

  public async getStock(storeId: string) {
    return (this.data.stock ?? []).filter((item) => item.storeId === storeId);
  }
}
