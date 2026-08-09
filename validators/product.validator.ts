import { z } from 'zod';
import { DEFAULT_PAGE, DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from '@/config/api';

const optionalQueryValue = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().trim().min(1).optional(),
);

const optionalSeasonValue = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.enum(['spring', 'summer', 'autumn', 'winter']).optional(),
);

export const productSortValidator = z.enum([
  'recommended',
  'price_asc',
  'price_desc',
  'newest',
]);

export const productQueryValidator = z.object({
  page: z.coerce.number().int().positive().default(DEFAULT_PAGE),
  limit: z.coerce
    .number()
    .int()
    .positive()
    .max(MAX_PAGE_LIMIT)
    .default(DEFAULT_PAGE_LIMIT),
  category: optionalQueryValue,
  subcategory: optionalQueryValue,
  keyword: optionalQueryValue,
  season: optionalSeasonValue,
  sort: productSortValidator.default('recommended'),
});

export const searchQueryValidator = productQueryValidator.extend({
  keyword: z.string().trim().min(1),
});

export type ProductQuery = z.infer<typeof productQueryValidator>;
export type SearchQuery = z.infer<typeof searchQueryValidator>;
