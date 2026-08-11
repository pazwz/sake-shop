import { compare } from 'bcryptjs';
import { AdminRole } from '@prisma/client';
import { UnauthorizedError } from '@/lib/errors';
import { AdminRepository } from '@/repositories/admin.repository';

export const CMS_ADMIN_ROLES: AdminRole[] = [
  AdminRole.OWNER,
  AdminRole.MANAGER,
];

export class AdminService {
  public constructor(private readonly repository = new AdminRepository()) {}

  async authenticate(email: string, password: string) {
    const admin = await this.repository.findByEmail(email);
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
}
