import { CollectionStatus, CollectionType, Season } from '@prisma/client';
import { z } from 'zod';
import { HOME_CONTENT_LIMITS } from '@/config/home';
import { EDITORIAL_SECTION_LIMIT } from '@/config/editorial';

const optionalText = z.string().trim().max(2000).optional().nullable();
const optionalDate = z.string().datetime().optional().nullable();
const productIds = (minimum = 0) =>
  z
    .array(z.string().cuid())
    .min(minimum)
    .max(24)
    .refine((ids) => new Set(ids).size === ids.length, {
      message: 'Product IDs must be unique.',
    });

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
  productIds: productIds().default([]),
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
  productIds: productIds(1),
});

export const editorialOrderValidator = z.object({
  collectionIds: z
    .array(z.string().cuid())
    .min(1)
    .max(HOME_CONTENT_LIMITS.editorial)
    .refine((ids) => new Set(ids).size === ids.length, {
      message: 'Collection IDs must be unique.',
    }),
});

const editorialSectionValidator = z.object({
  id: z.string().cuid().optional(),
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(10000),
  imageUrl: z.string().url().optional().nullable(),
  productId: z.string().cuid().optional().nullable(),
});

export const editorialSectionsValidator = z.object({
  sections: z
    .array(editorialSectionValidator)
    .max(EDITORIAL_SECTION_LIMIT)
    .refine(
      (sections) => {
        const ids = sections.flatMap((section) =>
          section.id ? [section.id] : [],
        );
        return new Set(ids).size === ids.length;
      },
      { message: 'Section IDs must be unique.' },
    ),
});

export type CollectionInput = z.infer<typeof collectionInputValidator>;
export type CollectionUpdate = z.infer<typeof collectionUpdateValidator>;
export type EditorialSectionInput = z.infer<typeof editorialSectionValidator>;
