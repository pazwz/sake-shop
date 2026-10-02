import { compare } from 'bcryptjs';
import { AdminRole } from '@prisma/client';
import { ForbiddenError, UnauthorizedError } from '@/lib/errors';
import { isDeveloper } from '@/lib/admin-access';
import { AdminRepository } from '@/repositories/admin.repository';

export const CMS_ADMIN_ROLES: AdminRole[] = [
  AdminRole.ADMIN,
  AdminRole.DEVELOPER,
  AdminRole.OWNER,
  AdminRole.MANAGER,
  AdminRole.STAFF,
];

export class AdminService {
  public constructor(private readonly repository = new AdminRepository()) {}

  async authenticate(identifier: string, password: string) {
    const admin = identifier.includes('@')
      ? await this.repository.findByEmail(identifier)
      : await this.repository.findByUsername(identifier);
    if (!admin?.isActive || !admin.passwordHash) {
      throw new UnauthorizedError('Invalid administrator credentials.');
    }
    if (!(await compare(password, admin.passwordHash))) {
      throw new UnauthorizedError('Invalid administrator credentials.');
    }
    await this.repository.updateLastLogin(admin.id);
    return admin;
  }

  async getActiveAdmin(id: string) {
    const admin = await this.repository.findById(id);
    if (!admin?.isActive || !admin.passwordHash) {
      throw new UnauthorizedError('Administrator session is invalid.');
    }
    return admin;
  }

  async getActiveDeveloper(id: string) {
    const admin = await this.getActiveAdmin(id);
    if (!isDeveloper(admin.role)) {
      throw new ForbiddenError('Developer access is required.');
    }
    return admin;
  }
}
