import assert from 'node:assert/strict';
import test from 'node:test';
import { AdminRole } from '@prisma/client';
import { AdminService } from '@/services/admin.service';
import { getAdminDisplayName } from '@/lib/admin-display-name';

test('active password-backed Admin sessions are valid regardless of role', async () => {
  for (const role of Object.values(AdminRole)) {
    const admin = {
      id: 'admin',
      role,
      isActive: true,
      passwordHash: 'configured',
    };
    const service = new AdminService({ findById: async () => admin } as never);
    assert.equal((await service.getActiveAdmin('admin')).id, 'admin');
  }
});

test('inactive and unconfigured Admins cannot use even a previously issued session', async () => {
  for (const admin of [
    { isActive: false, passwordHash: 'configured' },
    { isActive: true, passwordHash: null },
    null,
  ]) {
    const service = new AdminService({ findById: async () => admin } as never);
    await assert.rejects(() => service.getActiveAdmin('admin'), {
      statusCode: 401,
    });
  }
});

test('historical inactive and legacy developer authors retain neutral display identity', () => {
  assert.equal(
    getAdminDisplayName({ name: 'KURA Development Owner', isActive: false }),
    '旧管理者',
  );
  assert.equal(
    getAdminDisplayName({ name: 'Old Admin', isActive: false }),
    '旧管理者',
  );
  assert.equal(
    getAdminDisplayName({ name: 'KURA Development Staff', isActive: true }),
    '旧管理者',
  );
  assert.equal(
    getAdminDisplayName({ name: 'LINXAS Admin', isActive: true }),
    'LINXAS Admin',
  );
});
