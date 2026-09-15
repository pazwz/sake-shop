import { z } from 'zod';

const JAPANESE_PREFECTURES = [
  '北海道',
  '青森県',
  '岩手県',
  '宮城県',
  '秋田県',
  '山形県',
  '福島県',
  '茨城県',
  '栃木県',
  '群馬県',
  '埼玉県',
  '千葉県',
  '東京都',
  '神奈川県',
  '新潟県',
  '富山県',
  '石川県',
  '福井県',
  '山梨県',
  '長野県',
  '岐阜県',
  '静岡県',
  '愛知県',
  '三重県',
  '滋賀県',
  '京都府',
  '大阪府',
  '兵庫県',
  '奈良県',
  '和歌山県',
  '鳥取県',
  '島根県',
  '岡山県',
  '広島県',
  '山口県',
  '徳島県',
  '香川県',
  '愛媛県',
  '高知県',
  '福岡県',
  '佐賀県',
  '長崎県',
  '熊本県',
  '大分県',
  '宮崎県',
  '鹿児島県',
  '沖縄県',
] as const;

export const customerProfileValidator = z
  .object({ name: z.string().trim().min(1).max(100) })
  .strict();

export const customerAddressValidator = z
  .object({
    recipientName: z.string().trim().min(1).max(100),
    postalCode: z
      .string()
      .trim()
      .regex(/^\d{3}-?\d{4}$/)
      .transform((value) => value.replace('-', '')),
    prefecture: z.enum(JAPANESE_PREFECTURES),
    city: z.string().trim().min(1).max(100),
    addressLine1: z.string().trim().min(1).max(200),
    addressLine2: z
      .string()
      .trim()
      .max(200)
      .optional()
      .transform((value) => value || undefined),
    phone: z
      .string()
      .trim()
      .regex(/^0\d{1,4}-?\d{1,4}-?\d{3,4}$/)
      .transform((value) => value.replaceAll('-', '')),
    isDefault: z.boolean().optional().default(false),
  })
  .strict();

export const customerNewsletterPreferenceValidator = z
  .object({ subscribed: z.boolean() })
  .strict();

export type CustomerAddressInput = z.infer<typeof customerAddressValidator>;
