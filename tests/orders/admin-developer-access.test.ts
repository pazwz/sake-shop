import assert from 'node:assert/strict';
import test from 'node:test';
import { hash } from 'bcryptjs';
import type { AdminRole } from '@prisma/client';
import { AdminService } from '@/services/admin.service';

test('developer access denies every operational and legacy role', async () => {
  for (const role of ['ADMIN', 'OWNER', 'MANAGER', 'STAFF']) {
    const service = new AdminService({
      findById: async () => ({
        id: 'admin',
        role: role as AdminRole,
        isActive: true,
        passwordHash: 'configured',
      }),
    } as never);
    await assert.rejects(() => service.getActiveDeveloper('admin'), {
      statusCode: 403,
    });
  }
});

test('developer access permits an active password-backed developer only', async () => {
  const admin = {
    id: 'developer',
    role: 'DEVELOPER' as AdminRole,
    isActive: true,
    passwordHash: 'configured',
    email: null,
  };
  const service = new AdminService({ findById: async () => admin } as never);
  assert.equal((await service.getActiveDeveloper('developer')).id, 'developer');
  for (const invalid of [
    { ...admin, isActive: false },
    { ...admin, passwordHash: null },
    null,
  ]) {
    const invalidService = new AdminService({
      findById: async () => invalid,
    } as never);
    await assert.rejects(() => invalidService.getActiveDeveloper('developer'), {
      statusCode: 401,
    });
  }
});

test('nullable-email developer authenticates by username and rejects a wrong password', async () => {
  const passwordHash = await hash('Local-test-password-123!', 4);
  const admin = {
    id: 'developer',
    username: 'admin_developer',
    email: null,
    role: 'DEVELOPER' as AdminRole,
    isActive: true,
    passwordHash,
  };
  const lookups: string[] = [];
  const service = new AdminService({
    findByUsername: async (username: string) => {
      lookups.push(username);
      return admin;
    },
    findByEmail: async () => {
      throw new Error('Unexpected email lookup');
    },
    updateLastLogin: async () => admin,
  } as never);
  assert.equal(
    (await service.authenticate('admin_developer', 'Local-test-password-123!'))
      .email,
    null,
  );
  await assert.rejects(
    () => service.authenticate('admin_developer', 'wrong-password'),
    { statusCode: 401 },
  );
  assert.deepEqual(lookups, ['admin_developer', 'admin_developer']);
});

test('legacy email sign-in continues to use the email lookup', async () => {
  const admin = {
    id: 'legacy',
    email: 'admin@example.test',
    role: 'OWNER' as AdminRole,
    isActive: true,
    passwordHash: await hash('Local-test-password-123!', 4),
  };
  const service = new AdminService({
    findByEmail: async (email: string) => {
      assert.equal(email, 'admin@example.test');
      return admin;
    },
    findByUsername: async () => {
      throw new Error('Unexpected username lookup');
    },
    updateLastLogin: async () => admin,
  } as never);
  assert.equal(
    (
      await service.authenticate(
        'admin@example.test',
        'Local-test-password-123!',
      )
    ).id,
    'legacy',
  );
});
