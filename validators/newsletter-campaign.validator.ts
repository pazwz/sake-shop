import { z } from 'zod';
import { MAX_NEWSLETTER_SECTIONS } from '@/config/newsletter-campaign';

const optionalText = (maximum: number) =>
  z
    .string()
    .trim()
    .max(maximum)
    .optional()
    .nullable()
    .transform((value) => value || null);

const safeCtaUrl = z
  .string()
  .trim()
  .max(2048)
  .refine(
    (value) =>
      /^\/(?:products|collections)(?:\/|$)/.test(value) ||
      /^https:\/\//i.test(value),
    'CTA URL must be an internal product/collection path or HTTPS URL.',
  );

const optionalImageUrl = z
  .string()
  .trim()
  .url()
  .max(2048)
  .optional()
  .nullable()
  .transform((value) => value || null);

const campaignFields = z.object({
  subject: z.string().trim().min(1).max(120),
  preheader: optionalText(200),
  headline: z.string().trim().min(1).max(120),
  heroImageUrl: optionalImageUrl,
  heroImageAlt: optionalText(200),
  body: z.string().trim().min(1).max(10_000),
  ctaLabel: optionalText(80),
  ctaUrl: safeCtaUrl
    .optional()
    .nullable()
    .transform((value) => value || null),
});

const campaignContentValidator = campaignFields.superRefine(
  (value, context) => {
    if (Boolean(value.ctaLabel) !== Boolean(value.ctaUrl)) {
      context.addIssue({
        code: 'custom',
        path: ['ctaLabel'],
        message: 'CTA label and URL must be provided together.',
      });
    }
  },
);

export const newsletterCampaignCreateValidator = campaignContentValidator;
export const newsletterCampaignUpdateValidator = campaignFields.partial();

export const newsletterCampaignTestValidator = z
  .object({
    email: z.string().trim().email().max(254),
  })
  .strict();

export const newsletterCampaignScheduleValidator = z.object({
  scheduledAt: z.string().datetime(),
});

const sectionFields = z.object({
  id: z.string().cuid().optional(),
  imageUrl: optionalImageUrl,
  imageAlt: optionalText(200),
  headline: optionalText(120),
  body: optionalText(10_000),
  ctaLabel: optionalText(80),
  ctaUrl: safeCtaUrl
    .optional()
    .nullable()
    .transform((value) => value || null),
});

export const newsletterCampaignSectionValidator = sectionFields.superRefine(
  (value, context) => {
    if (Boolean(value.ctaLabel) !== Boolean(value.ctaUrl)) {
      context.addIssue({
        code: 'custom',
        path: ['ctaLabel'],
        message: 'CTA label and URL must be provided together.',
      });
    }
    if (!value.imageUrl && !value.headline && !value.body && !value.ctaLabel) {
      context.addIssue({
        code: 'custom',
        message: 'A section must contain an image, headline, body, or CTA.',
      });
    }
  },
);

export const newsletterCampaignSectionsValidator = z
  .object({
    sections: z.array(newsletterCampaignSectionValidator).max(MAX_NEWSLETTER_SECTIONS),
  })
  .strict();

export type NewsletterCampaignCreateInput = z.infer<
  typeof newsletterCampaignCreateValidator
>;
export type NewsletterCampaignUpdateInput = z.infer<
  typeof newsletterCampaignUpdateValidator
>;
export type NewsletterCampaignSectionsInput = z.infer<
  typeof newsletterCampaignSectionsValidator
>;
