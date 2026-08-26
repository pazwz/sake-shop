import { z } from 'zod';
import type { SMAREGI_CONTRACT_ACTIONS } from '@/config/smaregi';

export type SmaregiContractAction = (typeof SMAREGI_CONTRACT_ACTIONS)[number];

export type SmaregiContractNotification = {
  event: 'AppSubscription';
  action: SmaregiContractAction;
  date: string;
  contractId: string;
  clientId: string;
  plan: {
    trial_days: number;
    price: number;
    unit_price: number;
    quantity: number;
    name: string;
  };
  options: Array<{
    price: number;
    unit_price: number;
    quantity: number;
    name: string;
  }>;
};

export const smaregiStoreSchema = z.object({
  storeId: z.string().min(1),
  storeName: z.string().optional(),
});

export const smaregiCategorySchema = z.object({
  categoryId: z.string().min(1),
  categoryCode: z.string().optional().default(''),
  categoryName: z.string().min(1),
  displaySequence: z.string().optional().default('0'),
  displayFlag: z.string().optional().default('1'),
  parentCategoryId: z.string().optional().nullable().default(null),
});

export const smaregiProductSchema = z.object({
  productId: z.string().min(1),
  categoryId: z.string().min(1),
  productCode: z.string().min(1),
  productName: z.string().min(1),
  price: z.string().regex(/^-?\d+(\.\d+)?$/),
  displayFlag: z.string().optional().default('1'),
  salesDivision: z.string().optional().default('0'),
  division: z.string().optional().default('0'),
});

export const smaregiStockSchema = z.object({
  storeId: z.string().min(1),
  productId: z.string().min(1),
  stockAmount: z.string().regex(/^-?\d+$/),
});

export type SmaregiStore = z.infer<typeof smaregiStoreSchema>;
export type SmaregiCategory = z.infer<typeof smaregiCategorySchema>;
export type SmaregiProduct = z.infer<typeof smaregiProductSchema>;
export type SmaregiStock = z.infer<typeof smaregiStockSchema>;

export interface SmaregiApiClient {
  readonly retryCount: number;
  getStores(): Promise<SmaregiStore[]>;
  getCategories(): Promise<SmaregiCategory[]>;
  getProducts(): Promise<SmaregiProduct[]>;
  getStock(storeId: string): Promise<SmaregiStock[]>;
}

export type SmaregiSyncSummary = {
  processed: number;
  created: number;
  updated: number;
  skipped: number;
};
