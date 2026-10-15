import { expect, test } from '@playwright/test';
import { E2E_FIXTURES } from '@/config/e2e-fixtures';
import { requireNonProductionMutationEnvironment } from '@/e2e/helpers/environment';

test('Admin has no interval reads, resumes once after idle and exposes manual refresh', async ({ page }) => {
  requireNonProductionMutationEnvironment();
  const login = await page.request.post('/api/v1/admin/auth/login', { data: E2E_FIXTURES.staff });
  expect(login.status()).toBe(200);
  await page.clock.install();
  let summaries = 0;
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/v1/admin/inquiries/unread-summary') summaries++;
  });
  const initial = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/v1/admin/inquiries/unread-summary');
  await page.goto('/admin/inquiries', { waitUntil: 'domcontentloaded' });
  expect((await initial).status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'お問い合わせ管理' })).toBeVisible();
  // Next development StrictMode may mount/abort/remount effects; measure only new background requests.
  const initialCount = summaries;
  await page.clock.fastForward(90_000);
  expect(summaries).toBe(initialCount);
  await page.clock.fastForward(15 * 60_000);
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  expect(summaries).toBe(initialCount);
  const resumed = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/v1/admin/inquiries/unread-summary');
  await page.getByRole('heading', { name: 'お問い合わせ管理' }).click();
  expect((await resumed).status()).toBe(200);
  expect(summaries).toBe(initialCount + 1);
  await page.getByTestId('admin-notifications').locator('summary').click();
  const manual = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/v1/admin/inquiries/unread-summary');
  await page.getByRole('button', { name: '更新', exact: true }).click();
  expect((await manual).status()).toBe(200);
  expect(summaries).toBe(initialCount + 2);
});
