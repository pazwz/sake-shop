import { z } from 'zod';

export const adminProductMetadataStatusValues = [
  'all',
  'core_incomplete',
  'complete',
  'optional_incomplete',
] as const;

export const adminProductMissingFieldValues = [
  'all',
  'producer',
  'origin',
  'volume',
  'alcoholPercentage',
  'description',
  'image',
  'tastingNotes',
] as const;

const optionalQueryValue = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().trim().min(1).optional(),
);

export const productSlugValidator = z
  .string()
  .trim()
  .min(1, 'URLスラッグを設定してください。')
  .max(160)
  .transform((value) => value.toLowerCase())
  .refine((value) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value), {
    message: 'URLスラッグは半角英数字とハイフンで入力してください。',
  });

export const adminProductQueryValidator = z.object({
  q: optionalQueryValue,
  category: optionalQueryValue,
  ecStatus: z
    .enum(['all', 'published', 'preparing', 'hidden', 'excluded', 'retired'])
    .default('all'),
  source: z.enum(['all', 'smaregi', 'local']).default('all'),
  imageStatus: z.enum(['all', 'with', 'without']).default('all'),
  metadataStatus: z.enum(adminProductMetadataStatusValues).default('all'),
  missingField: z.enum(adminProductMissingFieldValues).default('all'),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(50).default(25),
});

const nullableText = z.string().trim().max(10000).nullable().optional();

export const adminProductUpdateValidator = z
  .object({
    slug: productSlugValidator.optional(),
    producer: z.string().trim().max(200).nullable().optional(),
    origin: z.string().trim().max(200).nullable().optional(),
    volume: z.string().trim().max(100).nullable().optional(),
    alcoholPercentage: z.number().min(0).max(100).nullable().optional(),
    description: nullableText,
    tastingNotes: nullableText,
    boxProductId: z.string().cuid().nullable().optional(),
    ecVisibility: z.enum(['published', 'hidden']).optional(),
    // Kept for backwards-compatible Admin clients. New UI sends ecVisibility.
    isEcAvailable: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: '更新する項目を指定してください。',
  });

export const adminProductImageValidator = z
  .object({
    imageUrl: z.string().url().max(2048),
    altText: z.string().trim().max(200).nullable().optional(),
  })
  .strict();

export const adminProductImageOrderValidator = z
  .object({ imageIds: z.array(z.string().min(1)).min(1).max(50) })
  .strict()
  .refine(({ imageIds }) => new Set(imageIds).size === imageIds.length, {
    message: '同じ商品画像を重複して指定できません。',
  });

export type AdminProductQuery = z.infer<typeof adminProductQueryValidator>;
export type AdminProductUpdate = z.infer<typeof adminProductUpdateValidator>;
export type AdminProductImageInput = z.infer<typeof adminProductImageValidator>;
