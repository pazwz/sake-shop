import type { ApiSuccessResponse } from '@/types/api';
import type {
  CategoryRecord,
  ProductListResult,
  ProductRecord,
} from '@/types/product';

const readResponse = async <T>(response: Response): Promise<T> => {
  const payload = (await response.json()) as ApiSuccessResponse<T>;

  if (!response.ok || !payload.success) {
    throw new Error('商品データを取得できませんでした。');
  }

  return payload.data;
};

export const getProducts = async (
  query: URLSearchParams,
): Promise<ProductListResult> =>
  readResponse<ProductListResult>(
    await fetch(`/api/v1/products?${query.toString()}`),
  );

export const getProduct = async (identifier: string): Promise<ProductRecord> =>
  readResponse<ProductRecord>(
    await fetch(`/api/v1/products/${encodeURIComponent(identifier)}`),
  );

export const getCategories = async (): Promise<CategoryRecord[]> =>
  readResponse<CategoryRecord[]>(await fetch('/api/v1/categories'));

export const searchProducts = async (
  query: URLSearchParams,
): Promise<ProductListResult> =>
  readResponse<ProductListResult>(
    await fetch(`/api/v1/search?${query.toString()}`),
  );
