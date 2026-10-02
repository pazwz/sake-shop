import { expect, test } from '@playwright/test';
import { mutationSuiteEnabled } from '@/e2e/helpers/environment';
import { E2E_FIXTURES } from '@/config/e2e-fixtures';
import { AdminRole, PrismaClient } from '@prisma/client';
import { getSafeE2EDatabaseEnvironment } from '@/config/e2e-database';

const staffCredentialsConfigured = () =>
  Boolean(process.env.E2E_STAFF_USERNAME && process.env.E2E_STAFF_PASSWORD);

test.describe('E2E-12: operational and developer Admin boundary', () => {
  test.skip(
    !mutationSuiteEnabled() || !staffCredentialsConfigured(),
    'Requires explicit local/preview STAFF credentials.',
  );

  test('an operational ADMIN reaches collection pages but cannot access developer tools', async ({
    page,
  }) => {
    await page.goto('/admin/login');
    await page.getByLabel('ログインID').fill(process.env.E2E_STAFF_USERNAME!);
    await page.getByLabel('パスワード').fill(process.env.E2E_STAFF_PASSWORD!);
    const loginResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/admin/auth/login') &&
        response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'ログイン' }).click();
    await expect((await loginResponse).status()).toBe(200);

    const invalid = await page.request.post('/api/v1/admin/media/presign', {
      data: {},
    });
    expect(invalid.status()).toBe(422);
    await page.goto('/admin/collections/all');
    await expect(page).toHaveURL(/\/admin\/collections\/all$/);
    await expect(page.getByTestId('admin-workspace')).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'メールプレビュー', exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('link', { name: '運用状態', exact: true }),
    ).toHaveCount(0);
    await expect(page.getByText('/ ADMIN', { exact: false })).toHaveCount(0);
    for (const path of ['/admin/email-preview', '/admin/operations']) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/admin$/);
      await expect(
        page.getByRole('heading', { name: 'ダッシュボード' }),
      ).toBeVisible();
    }
    for (const path of [
      '/api/v1/admin/operations/health',
      '/api/v1/admin/integrations/smaregi',
      '/api/v1/admin/integrations/smaregi/sync/nonexistent/items',
    ]) {
      const denied = await page.request.get(path);
      expect(denied.status()).toBe(403);
      expect((await denied.json()).error.code).toBe('FORBIDDEN');
    }
    await page.goto('/admin/integrations/smaregi');
    await expect(
      page.getByRole('button', { name: '今すぐ同期' }),
    ).toBeVisible();
    await expect(
      page.getByText('Client credentials', { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('heading', { name: 'Recent SyncLog' }),
    ).toHaveCount(0);
  });

  test('a null-email DEVELOPER signs in by username and can access developer pages and APIs', async ({
    page,
  }) => {
    await page.goto('/admin/login');
    await page.getByLabel('ログインID').fill(E2E_FIXTURES.developer.username);
    await page.getByLabel('パスワード').fill(E2E_FIXTURES.developer.password);
    await page.getByRole('button', { name: 'ログイン' }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByText('開発者', { exact: true })).toBeVisible();
    await page.goto('/admin/email-preview');
    await expect(
      page.getByRole('heading', { name: 'メールテンプレート' }),
    ).toBeVisible();
    await page.goto('/admin/operations');
    await expect(
      page.getByRole('heading', { name: 'System Health' }),
    ).toBeVisible();
    expect(
      (await page.request.get('/api/v1/admin/operations/health')).status(),
    ).toBe(200);
    expect(
      (await page.request.get('/api/v1/admin/integrations/smaregi')).status(),
    ).toBe(200);
    const safe = getSafeE2EDatabaseEnvironment();
    const database = new PrismaClient({ datasourceUrl: safe.databaseUrl });
    try {
      const account = await database.adminUser.findUniqueOrThrow({
        where: { username: E2E_FIXTURES.developer.username },
      });
      expect(account.email).toBeNull();
      // Existing signed DEVELOPER cookie must not override the current DB role or activity.
      await database.adminUser.update({
        where: { id: account.id },
        data: { role: AdminRole.ADMIN },
      });
      expect(
        (await page.request.get('/api/v1/admin/operations/health')).status(),
      ).toBe(403);
      await database.adminUser.update({
        where: { id: account.id },
        data: { role: AdminRole.DEVELOPER, isActive: false },
      });
      expect(
        (await page.request.get('/api/v1/admin/operations/health')).status(),
      ).toBe(401);
    } finally {
      await database.adminUser.update({
        where: { username: E2E_FIXTURES.developer.username },
        data: { role: AdminRole.DEVELOPER, isActive: true },
      });
      await database.$disconnect();
    }
  });
});
