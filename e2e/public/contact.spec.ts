import { expect, test } from '@playwright/test';

test('E2E-11: contact form validates locally without submitting an email', async ({
  page,
}) => {
  await page.goto('/contact');
  await expect(page.getByRole('heading', { name: 'お問い合わせ' })).toBeVisible();
  await page.getByRole('button', { name: '送信する' }).click();
  await expect(page.getByText('メールアドレスを入力してください。')).toBeVisible();
  await expect(page.getByText('お問い合わせ内容を入力してください。')).toBeVisible();
});
