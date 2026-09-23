import { ContactInquiryStatus } from '@prisma/client';
import { z } from 'zod';

const optionalText = (max: number) => z.string().trim().max(max).optional();

export const inquiryListValidator = z
  .object({
    page: z.coerce.number().int().min(1).max(100000).default(1),
    status: z.nativeEnum(ContactInquiryStatus).optional(),
    assignedAdminId: optionalText(64),
    topic: optionalText(64),
    q: optionalText(254),
  })
  .strict();

export const inquiryAssignmentValidator = z
  .object({ assignedAdminId: z.string().trim().min(1).max(64).nullable() })
  .strict();

export const inquiryStatusValidator = z
  .object({ status: z.nativeEnum(ContactInquiryStatus) })
  .strict();

export const inquiryReplyValidator = z
  .object({
    body: z.string().trim().min(1).max(5000),
    subject: z.string().trim().min(1).max(200).optional(),
    idempotencyKey: z.string().uuid(),
  })
  .strict();

export const inquiryNoteValidator = z
  .object({ body: z.string().trim().min(1).max(5000) })
  .strict();

export type InquiryListInput = z.infer<typeof inquiryListValidator>;
