import assert from 'node:assert/strict';
import test from 'node:test';
import { AdminRole } from '@prisma/client';
import { SignJWT } from 'jose';
import { createAdminSessionToken, readAdminSessionToken } from '@/lib/admin-session';

test('Admin signed session is accepted before 1h and rejected exactly at idle deadline', async (t) => {
  process.env.ADMIN_SESSION_SECRET = 'test-only-admin-session-secret';
  t.mock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 9, 15) });
  const token = await createAdminSessionToken({ adminId: 'admin', role: AdminRole.ADMIN });
  t.mock.timers.tick(59 * 60_000);
  assert.equal((await readAdminSessionToken(token))?.adminId, 'admin');
  t.mock.timers.tick(60_000);
  assert.equal(await readAdminSessionToken(token), null);
});

test('legacy tokens without an idle claim and tampered tokens fail closed', async () => {
  process.env.ADMIN_SESSION_SECRET = 'test-only-admin-session-secret';
  const legacy = await new SignJWT({ adminId: 'admin', role: AdminRole.DEVELOPER })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('8h')
    .sign(new TextEncoder().encode(process.env.ADMIN_SESSION_SECRET));
  assert.equal(await readAdminSessionToken(legacy), null);
  assert.equal(await readAdminSessionToken(legacy + 'broken'), null);
});

test('renewal extends idle deadline but never the original eight-hour absolute lifetime', async (t) => {
  process.env.ADMIN_SESSION_SECRET = 'test-only-admin-session-secret';
  t.mock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 9, 15) });
  let token = await createAdminSessionToken({ adminId: 'admin', role: AdminRole.DEVELOPER });
  const original = await readAdminSessionToken(token);
  assert.ok(original);
  for (let i = 0; i < 8; i++) {
    t.mock.timers.tick(59 * 60_000);
    const session = await readAdminSessionToken(token);
    assert.ok(session);
    token = await createAdminSessionToken({ adminId: session.adminId, role: session.role }, session);
    assert.equal((await readAdminSessionToken(token))?.expiresAt, original.expiresAt);
  }
  t.mock.timers.tick(8 * 60_000);
  assert.equal(await readAdminSessionToken(token), null);
});
