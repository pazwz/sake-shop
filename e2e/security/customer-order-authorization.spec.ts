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
      const orderPath = `/account/orders/${encodeURIComponent(orderNumber)}`;
      await ownerPage.goto(orderPath, { waitUntil: 'domcontentloaded' });
      await expect(ownerPage).toHaveURL(new URL(orderPath, ownerPage.url()).href);
      await expect(ownerPage.getByRole('heading', { name: '注文詳細', exact: true })).toBeVisible();
      await expect(ownerPage.getByTestId('order-number')).toContainText(orderNumber);

      const otherPage = await otherCustomer.newPage();
      await loginCustomer(
        otherPage,
        process.env.E2E_QA_SECONDARY_EMAIL!,
        process.env.E2E_QA_SECONDARY_PASSWORD!,
      );
      const response = await otherPage.goto(
        orderPath,
        { waitUntil: 'domcontentloaded' },
      );
      await expect(otherPage).toHaveURL(new URL(orderPath, otherPage.url()).href);
      // App Router may stream a notFound() boundary after the outer layout has
      // committed its 200 response. Assert the rendered 404 boundary and the
      // absence of order data instead of treating that transport detail as an
      // authorization success.
      expect(response?.status()).toBe(200);
      await expect(otherPage.getByText('404')).toBeVisible();
      await expect(
        otherPage.getByTestId('order-number'),
      ).not.toBeVisible();
    } finally {
      await owner.close();
      await otherCustomer.close();
    }
  });
});
