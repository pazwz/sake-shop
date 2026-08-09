import { CollectionStatus, CollectionType, Season } from '@prisma/client';
import { z } from 'zod';

const optionalText = z.string().trim().max(2000).optional().nullable();
const optionalDate = z.string().datetime().optional().nullable();

const collectionFields = z.object({
  type: z.nativeEnum(CollectionType),
  season: z.nativeEnum(Season).optional().nullable(),
  title: z.string().trim().min(1).max(200),
  subtitle: optionalText,
  description: optionalText,
  desktopImageUrl: z.string().url().optional().nullable(),
  mobileImageUrl: z.string().url().optional().nullable(),
  status: z.nativeEnum(CollectionStatus).default(CollectionStatus.DRAFT),
  publishStartAt: optionalDate,
  publishEndAt: optionalDate,
  displayOrder: z.number().int().min(0).default(0),
  productIds: z.array(z.string().cuid()).max(24).default([]),
});

export const collectionInputValidator = collectionFields.superRefine(
  (value, context) => {
    if (value.type === CollectionType.SEASONAL && !value.season) {
      context.addIssue({
        code: 'custom',
        path: ['season'],
        message: 'Season is required.',
      });
    }
    if (value.type !== CollectionType.SEASONAL && value.season) {
      context.addIssue({
        code: 'custom',
        path: ['season'],
        message: 'Season is only available for seasonal collections.',
      });
    }
  },
);

export const collectionUpdateValidator = collectionFields.partial();

export const collectionProductOrderValidator = z.object({
  productIds: z.array(z.string().cuid()).min(1).max(24),
});

export type CollectionInput = z.infer<typeof collectionInputValidator>;
export type CollectionUpdate = z.infer<typeof collectionUpdateValidator>;
