import { ContactInquiryStatus } from '@prisma/client';

export const CONTACT_INQUIRY_STATUS_LABELS: Record<
  ContactInquiryStatus,
  string
> = {
  NEW: '未対応',
  IN_PROGRESS: '対応中',
  ANSWERED: 'お客様返信待ち',
  CLOSED: '解決済み',
};
