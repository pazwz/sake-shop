import { ContactInquiryStatus } from '@prisma/client';

export const CONTACT_INQUIRY_STATUS_LABELS: Record<
  ContactInquiryStatus,
  string
> = {
  NEW: '未対応',
  IN_PROGRESS: '対応中',
  ANSWERED: '回答済み',
  CLOSED: '完了',
};
