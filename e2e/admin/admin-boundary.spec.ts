import { expect, test } from '@playwright/test';
import { mutationSuiteEnabled } from '@/e2e/helpers/environment';

const staffCredentialsConfigured = () =>
  Boolean(process.env.E2E_STAFF_USERNAME && process.env.E2E_STAFF_PASSWORD);

test.describe('E2E-12: valid Admin boundary independent of role', () => {
  test.skip(
    !mutationSuiteEnabled() || !staffCredentialsConfigured(),
    'Requires explicit local/preview STAFF credentials.',
  );

  test('a valid STAFF Admin reaches validation and collection pages', async ({ page }) => {
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
  });
});
