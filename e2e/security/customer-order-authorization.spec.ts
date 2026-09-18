import { expect, test } from '@playwright/test';
import {
  loginCustomer,
  qaCredentialsConfigured,
} from '@/e2e/helpers/customer';
import { mutationSuiteEnabled } from '@/e2e/helpers/environment';

const secondaryCredentialsConfigured = () =>
  Boolean(
    process.env.E2E_QA_SECONDARY_EMAIL &&
      process.env.E2E_QA_SECONDARY_PASSWORD &&
      process.env.E2E_QA_ORDER_NUMBER,
  );

test.describe('E2E-08: customer order authorization', () => {
  test.skip(
    !mutationSuiteEnabled() ||
      !qaCredentialsConfigured() ||
      !secondaryCredentialsConfigured(),
    'Requires explicit local/preview QA customer A, customer B, and order fixtures.',
  );

  test('only the owning customer can view the seeded order', async ({ browser }) => {
    const orderNumber = process.env.E2E_QA_ORDER_NUMBER!;
    const owner = await browser.newContext();
    const otherCustomer = await browser.newContext();
    try {
      const ownerPage = await owner.newPage();
      await loginCustomer(
        ownerPage,
        process.env.E2E_QA_EMAIL!,
        process.env.E2E_QA_PASSWORD!,
      );
      await ownerPage.goto(`/account/orders/${encodeURIComponent(orderNumber)}`);
      await expect(ownerPage.getByRole('heading', { name: orderNumber })).toBeVisible();

      const otherPage = await otherCustomer.newPage();
      await loginCustomer(
        otherPage,
        process.env.E2E_QA_SECONDARY_EMAIL!,
        process.env.E2E_QA_SECONDARY_PASSWORD!,
      );
      const response = await otherPage.goto(
        `/account/orders/${encodeURIComponent(orderNumber)}`,
      );
      expect(response?.status()).toBe(404);
    } finally {
      await owner.close();
      await otherCustomer.close();
    }
  });
});
