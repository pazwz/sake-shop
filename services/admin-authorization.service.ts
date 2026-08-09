import { AdminRole } from '@prisma/client';
import { cookies } from 'next/headers';
import { ForbiddenError, UnauthorizedError } from '@/lib/errors';
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

export const requireAdmin = async (roles?: AdminRole[]) => {
  const admin = await getCurrentAdmin();
  if (!admin)
    throw new UnauthorizedError('Administrator authentication is required.');
  if (roles && !roles.includes(admin.role)) {
    throw new ForbiddenError('Administrator permission is denied.');
  }
  return admin;
};

export const cmsAdminRoles = CMS_ADMIN_ROLES;
