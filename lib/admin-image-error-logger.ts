import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';

export const logAdminImageError = (
  stage: 'presign' | 'save',
  error: unknown,
) => {
  const prismaError =
    error instanceof Prisma.PrismaClientKnownRequestError ? error : null;
  const initializationError =
    error instanceof Prisma.PrismaClientInitializationError ? error : null;
  const rawCode = prismaError?.code ?? initializationError?.errorCode;
  const missingConfiguration =
    error instanceof Error
      ? error.message.match(
          /^(AWS_REGION|AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|AWS_S3_BUCKET|AWS_CLOUDFRONT_DOMAIN) is required for AWS S3 storage\.$/,
        )?.[1]
      : undefined;
  console.error(
    JSON.stringify({
      level: 'error',
      route:
        stage === 'presign'
          ? '/api/v1/admin/media/presign'
          : '/api/v1/admin/products/[id]/images',
      requestId: randomUUID(),
      stage,
      errorName: prismaError
        ? 'PrismaClientKnownRequestError'
        : initializationError
          ? 'PrismaClientInitializationError'
          : 'Error',
      code: missingConfiguration
        ? 'STORAGE_CONFIGURATION_MISSING'
        : rawCode && /^P\d{4}$/.test(rawCode)
          ? rawCode
          : null,
      missingConfiguration,
      message:
        stage === 'presign'
          ? 'Image upload preparation failed.'
          : 'Image save failed.',
    }),
  );
};
