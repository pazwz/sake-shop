import { z } from 'zod';

export const environmentSchema = z.object({
  DATABASE_URL: z.string().min(1),
  NEXTAUTH_SECRET: z.string().min(1),
  JWT_SECRET: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_REGION: z.string().min(1),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  AWS_REGION: z.string().min(1),
  AWS_ACCESS_KEY_ID: z.string().min(1),
  AWS_SECRET_ACCESS_KEY: z.string().min(1),
  AWS_S3_BUCKET: z.string().min(1),
  AWS_CLOUDFRONT_DOMAIN: z.string().min(1),
  SMAREGI_CLIENT_ID: z.string().min(1),
  SMAREGI_CLIENT_SECRET: z.string().min(1),
  SMAREGI_ENVIRONMENT: z.enum(['sandbox', 'production']),
  SMAREGI_CONTRACT_ID: z.string().min(1),
  SMAREGI_STORE_ID: z.string().min(1),
  PAYMENT_PROVIDER: z.string().min(1),
});

export type Environment = z.infer<typeof environmentSchema>;

export const smaregiEnvironmentSchema = environmentSchema.pick({
  SMAREGI_ENVIRONMENT: true,
  SMAREGI_CONTRACT_ID: true,
  SMAREGI_CLIENT_ID: true,
  SMAREGI_CLIENT_SECRET: true,
  SMAREGI_STORE_ID: true,
});

export type SmaregiEnvironment = z.infer<typeof smaregiEnvironmentSchema>;
