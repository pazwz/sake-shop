import { z } from 'zod';

export const environmentSchema = z.object({
  DATABASE_URL: z.string().min(1),
  NEXTAUTH_SECRET: z.string().min(1),
  JWT_SECRET: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_REGION: z.string().min(1),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  SMAREGI_CLIENT_ID: z.string().min(1),
  SMAREGI_CLIENT_SECRET: z.string().min(1),
  PAYMENT_PROVIDER: z.string().min(1),
});

export type Environment = z.infer<typeof environmentSchema>;
