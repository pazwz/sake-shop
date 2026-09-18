import { expect, type Page } from '@playwright/test';
import {
  mutationSuiteEnabled,
  requireNonProductionMutationEnvironment,
} from '@/e2e/helpers/environment';

export const qaCredentialsConfigured = () =>
  Boolean(process.env.E2E_QA_EMAIL && process.env.E2E_QA_PASSWORD);

export const canRunQaCustomerTests = () =>
  mutationSuiteEnabled() && qaCredentialsConfigured();

export const loginCustomer = async (
  page: Page,
  email: string,
  password: string,
) => {
  requireNonProductionMutationEnvironment();
  await page.goto('/login');
  await page.getByLabel('メールアドレス').fill(email);
  await page.getByLabel('パスワード').fill(password);
  const response = page.waitForResponse(
    (candidate) =>
      candidate.url().includes('/api/v1/customer/login') &&
      candidate.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'ログインする' }).click();
  await expect((await response).status()).toBe(200);
  await expect(page).toHaveURL(/\/account$/);
};

export const loginQaCustomer = async (page: Page) => {
  if (!qaCredentialsConfigured())
    throw new Error('E2E_QA_CREDENTIALS_REQUIRED');
  return loginCustomer(
    page,
    process.env.E2E_QA_EMAIL!,
    process.env.E2E_QA_PASSWORD!,
  );
};

export const clearCart = async (page: Page) => {
  await page.evaluate(() => localStorage.removeItem('kura-cart'));
};
