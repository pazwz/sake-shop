import { expect, test } from '@playwright/test';

test('E2E-12: anonymous visitors are redirected from Admin', async ({ page }) => {
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/login/);
  await expect(page.getByRole('heading', { name: '管理者ログイン' })).toBeVisible();
});

test('E2E operations dashboard remains inside the Admin boundary', async ({ page }) => {
  await page.goto('/admin/operations');
  await expect(page).toHaveURL(/\/admin\/login/);
});
