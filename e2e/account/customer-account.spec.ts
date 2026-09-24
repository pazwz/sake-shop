import { expect, test } from '@playwright/test';
import { canRunQaCustomerTests, loginQaCustomer } from '@/e2e/helpers/customer';

test.describe('E2E-06 and E2E-07: guarded QA customer account', () => {
  test.skip(
    !canRunQaCustomerTests(),
    'Requires local/preview E2E_ALLOW_MUTATIONS=true and QA credentials.',
  );

  test('logs in, opens My Page, and logs out', async ({ page }) => {
    await loginQaCustomer(page);
    await expect(page.getByRole('heading', { name: 'アカウント' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'ご注文履歴' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'お届け先' })).toBeVisible();
    await page.getByRole('button', { name: 'ログアウト' }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.goto('/account');
    await expect(page).toHaveURL(
      (url) =>
        url.pathname === '/login' && url.searchParams.get('redirect') === '/account',
    );
  });
});
