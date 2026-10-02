import { AdminRole } from '@prisma/client';

// Legacy roles remain operational only; none implicitly grants developer access.
export const isDeveloper = (role: AdminRole) => role === AdminRole.DEVELOPER;
