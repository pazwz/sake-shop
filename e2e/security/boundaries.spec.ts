import { expect, test } from '@playwright/test';

test('E2E-12: anonymous visitors are redirected from Admin', async ({ page }) => {
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/login/);
  await expect(page.getByRole('heading', { name: '管理者ログイン' })).toBeVisible();
});
