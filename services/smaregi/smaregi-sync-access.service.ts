import { timingSafeEqual } from 'node:crypto';
import { AdminRole } from '@prisma/client';
import { ConflictError, ForbiddenError, UnauthorizedError } from '@/lib/errors';
import type {
  SmaregiProductionSyncSkipped,
  SmaregiProductionSyncSummary,
} from '@/types/smaregi-production-sync';

export const SMAREGI_SYNC_ADMIN_ROLES = [
  AdminRole.OWNER,
  AdminRole.MANAGER,
] as const;

export const assertSmaregiSyncAdminRole = (role: AdminRole) => {
  if (
    !SMAREGI_SYNC_ADMIN_ROLES.includes(
      role as (typeof SMAREGI_SYNC_ADMIN_ROLES)[number],
    )
  ) {
    throw new ForbiddenError('スマレジ同期を実行する権限がありません。');
  }
};

export const assertCronAuthorization = (
  authorization: string | null,
  configuredSecret = process.env.CRON_SECRET,
) => {
  if (!configuredSecret || !authorization?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Cron authentication failed.');
  }
  const provided = authorization.slice('Bearer '.length);
  const expectedBuffer = Buffer.from(configuredSecret);
  const providedBuffer = Buffer.from(provided);
  if (
    expectedBuffer.length !== providedBuffer.length ||
    !timingSafeEqual(expectedBuffer, providedBuffer)
  ) {
    throw new UnauthorizedError('Cron authentication failed.');
  }
};

export const requireAvailableManualSync = (
  result: SmaregiProductionSyncSummary | SmaregiProductionSyncSkipped,
) => {
  if (result.outcome === 'SKIPPED_ALREADY_RUNNING') {
    throw new ConflictError('現在スマレジ同期を実行中です。');
  }
  return result;
};
