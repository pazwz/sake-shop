import { SiteAnnouncementType } from '@prisma/client';
import { z } from 'zod';
const date = z.coerce.date();
export const siteAnnouncementValidator = z.object({ title: z.string().trim().min(1).max(160), body: z.string().trim().min(1).max(10000), type: z.nativeEnum(SiteAnnouncementType), publishedAt: date, expiresAt: date.nullable().optional(), isPublished: z.boolean() }).strict().refine((value) => !value.expiresAt || value.expiresAt > value.publishedAt, { message: '終了日時は公開日時より後にしてください。', path: ['expiresAt'] });
export type SiteAnnouncementInput = z.infer<typeof siteAnnouncementValidator>;
