import { AdminRole } from '@prisma/client';
import { cookies } from 'next/headers';
import { UnauthorizedError } from '@/lib/errors';
import {
  ADMIN_SESSION_COOKIE,
  readAdminSessionToken,
} from '@/lib/admin-session';
import { AdminService, CMS_ADMIN_ROLES } from '@/services/admin.service';

const adminService = new AdminService();

export const getCurrentAdmin = async () => {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  const session = await readAdminSessionToken(token);
  if (!session) return null;
  try {
    return await adminService.getActiveAdmin(session.adminId);
  } catch {
    return null;
  }
};

// Legacy role arguments remain source-compatible; validity is checked against
// the current database account on every request, never against its role.
export const requireAdmin = async (_legacyRoles?: AdminRole[]) => {
  const admin = await getCurrentAdmin();
  if (!admin)
    throw new UnauthorizedError('Administrator authentication is required.');
  return admin;
};

export const cmsAdminRoles = CMS_ADMIN_ROLES;

export const requireDeveloper = async () => {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  const session = await readAdminSessionToken(token);
  if (!session) {
    throw new UnauthorizedError('Administrator authentication is required.');
  }
  return adminService.getActiveDeveloper(session.adminId);
};
