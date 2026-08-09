import { AdminRole } from '@prisma/client';

export const developmentSeedAdmin = {
  email: 'owner@kura.local',
  name: 'KURA Development Owner',
  role: AdminRole.OWNER,
  isActive: false,
} as const;
