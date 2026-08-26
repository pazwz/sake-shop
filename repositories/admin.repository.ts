import { prisma } from '@/lib/prisma';

export class AdminRepository {
  findByUsername(username: string) {
    return prisma.adminUser.findUnique({ where: { username } });
  }

  findByEmail(email: string) {
    return prisma.adminUser.findUnique({ where: { email } });
  }

  findById(id: string) {
    return prisma.adminUser.findUnique({ where: { id } });
  }

  updateLastLogin(id: string) {
    return prisma.adminUser.update({
      where: { id },
      data: { lastLoginAt: new Date() },
    });
  }
}
