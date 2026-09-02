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
  storeCode: z.string().optional(),
  storeName: z.string().optional(),
  division: z.string().optional(),
  pauseFlag: z.string().optional(),
});

export const smaregiCategorySchema = z.object({
  categoryId: z.string().min(1),
  categoryCode: z
    .string()
    .nullish()
    .transform((value) => value ?? ''),
  categoryName: z.string().min(1),
  displaySequence: z
    .string()
    .regex(/^\d+$/)
    .nullish()
    .transform((value) => value ?? '0'),
  displayFlag: z.string().optional().default('1'),
  parentCategoryId: z.string().optional().nullable().default(null),
  taxDivision: z.enum(['0', '1', '2']).nullable(),
  reduceTaxId: z.string().min(1).nullable(),
  insDateTime: z.string().optional(),
  updDateTime: z.string().optional(),
});

export const smaregiProductSchema = z.object({
  productId: z.string().min(1),
  categoryId: z.string().min(1),
  productCode: z.string().min(1),
  productName: z.string().min(1),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/),
  displayFlag: z.string().optional().default('1'),
  salesDivision: z.string().optional().default('0'),
  division: z.string().optional().default('0'),
  taxDivision: z.enum(['0', '1', '2']),
  useCategoryReduceTax: z.enum(['0', '1']),
  reduceTaxId: z.string().min(1).nullable(),
});

export const smaregiStockSchema = z.object({
  storeId: z.string().min(1),
  productId: z.string().min(1),
  stockAmount: z.string().regex(/^-?\d+$/),
  layawayStockAmount: z
    .string()
    .regex(/^-?\d+$/)
    .optional()
    .default('0'),
  updDateTime: z.string().optional(),
});

export type SmaregiStore = z.infer<typeof smaregiStoreSchema>;
export type SmaregiCategory = z.infer<typeof smaregiCategorySchema>;
export type SmaregiProduct = z.infer<typeof smaregiProductSchema>;
export type SmaregiStock = z.infer<typeof smaregiStockSchema>;

const smaregiDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const smaregiTaxRateSchema = z.string().regex(/^\d{1,3}(\.\d{1,3})?$/);

export const smaregiConsumptionTaxRateSchema = z.object({
  applyStartDate: smaregiDateSchema,
  taxRate: smaregiTaxRateSchema,
  taxRounding: z.enum(['0', '1', '2']),
});

export const smaregiReduceTaxRateSchema = z.object({
  reduceTaxId: z.string().min(1),
  name: z.string().optional(),
  division: z.enum(['1', '2']),
  rate: smaregiTaxRateSchema,
  termStart: smaregiDateSchema,
  termEnd: smaregiDateSchema.nullable(),
  condition: z.string().nullable().optional(),
  advancedCondition: z.enum(['0', '1']).nullable().optional(),
  insDateTime: z.string().optional(),
  updDateTime: z.string().optional(),
});

export type SmaregiConsumptionTaxRate = z.infer<
  typeof smaregiConsumptionTaxRateSchema
>;
export type SmaregiReduceTaxRate = z.infer<typeof smaregiReduceTaxRateSchema>;

export interface SmaregiApiClient {
  readonly retryCount: number;
  getStores(): Promise<SmaregiStore[]>;
  getCategories(): Promise<SmaregiCategory[]>;
  getProducts(): Promise<SmaregiProduct[]>;
  getStock(storeId: string): Promise<SmaregiStock[]>;
  getConsumptionTaxRates(): Promise<SmaregiConsumptionTaxRate[]>;
  getReduceTaxRates(): Promise<SmaregiReduceTaxRate[]>;
}

export type SmaregiSyncSummary = {
  processed: number;
  created: number;
  updated: number;
  skipped: number;
};
