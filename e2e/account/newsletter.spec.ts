import { expect, test } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { E2E_FIXTURES } from '@/config/e2e-fixtures';
import { getSafeE2EDatabaseEnvironment } from '@/config/e2e-database';
import { loginQaCustomer } from '@/e2e/helpers/customer';
import { requireNonProductionMutationEnvironment } from '@/e2e/helpers/environment';
import { createNewsletterUnsubscribeToken } from '@/lib/newsletter-unsubscribe-token';
import {
  createEmailActionToken,
  hashEmailActionToken,
} from '@/lib/email-action-token';

test.describe('newsletter consent and confirmation', () => {
  test('anonymous signup, read-only link, confirmed unsubscribe, and My Page re-consent', async ({
    page,
    browser,
  }) => {
    test.setTimeout(90_000);
    requireNonProductionMutationEnvironment();
    expect(process.env.E2E_BASE_URL).toBeUndefined();
    expect(process.env.JWT_SECRET).toBeTruthy();
    expect(process.env.E2E_QA_EMAIL).toBe(E2E_FIXTURES.customer.email);
    const isolated = getSafeE2EDatabaseEnvironment();
    const database = new PrismaClient({ datasourceUrl: isolated.databaseUrl });
    const originalFixture = await database.newsletterSubscription.findUnique({
      where: { email: E2E_FIXTURES.customer.email },
      select: { unsubscribeTokenHash: true },
    });
    await loginQaCustomer(page);
    const preference = await page.request.get(
      '/api/v1/customer/preferences/newsletter',
    );
    expect(preference.ok()).toBe(true);
    const originalSubscribed = (await preference.json()).data.subscribed;
    const anonymous = await browser.newContext({
      baseURL: new URL(page.url()).origin,
    });
    const newsletter = await anonymous.newPage();
    try {
      await newsletter.goto('/newsletter');
      const consent = newsletter.getByRole('checkbox', {
        name: 'メールマガジンの配信に同意します。',
      });
      await expect(consent).not.toBeChecked();
      await newsletter
        .getByLabel('メールアドレス')
        .fill(E2E_FIXTURES.customer.email);
      await expect(
        newsletter.getByRole('button', { name: '登録する' }),
      ).toBeDisabled();
      await consent.check();
      const signup = newsletter.waitForResponse(
        (response) =>
          response.url().endsWith('/api/v1/newsletter/subscribe') &&
          response.request().method() === 'POST',
      );
      await newsletter.getByRole('button', { name: '登録する' }).click();
      expect((await signup).ok()).toBe(true);
      await expect(newsletter.getByRole('status')).toContainText(
        'メールマガジンの登録を受け付けました',
      );
      await page.goto('/account/preferences');
      await expect(page.getByText('現在：購読中')).toBeVisible();

      const fixture = await database.newsletterSubscription.findUniqueOrThrow({
        where: { email: E2E_FIXTURES.customer.email },
      });
      // Only this guarded fixture is re-signed: previous local runs may use a different secret.
      // Production hashes and legacy link behavior are never changed by application code.
      const subscription = await database.newsletterSubscription.update({
        where: { email: E2E_FIXTURES.customer.email },
        data: {
          unsubscribeTokenHash: hashEmailActionToken(
            createEmailActionToken(fixture.id, 'newsletter-unsubscribe'),
          ),
        },
      });
      const token = createNewsletterUnsubscribeToken(subscription.id);
      const link = `/newsletter/unsubscribe?token=${encodeURIComponent(token)}`;
      await newsletter.goto(link);
      await expect(
        newsletter.getByRole('button', { name: '配信停止する', exact: true }),
      ).toBeVisible();
      const afterGet = await database.newsletterSubscription.findUniqueOrThrow({
        where: { email: E2E_FIXTURES.customer.email },
      });
      expect(afterGet.status).toBe('SUBSCRIBED');
      expect(afterGet.unsubscribedAt).toBeNull();
      expect(afterGet.updatedAt).toEqual(subscription.updatedAt);
      await expect(newsletter.locator('meta[name="robots"]')).toHaveAttribute(
        'content',
        'noindex, nofollow',
      );
      await expect(newsletter.locator('meta[name="referrer"]')).toHaveAttribute(
        'content',
        'no-referrer',
      );

      const unsubscribe = newsletter.waitForResponse(
        (response) =>
          response.url().endsWith('/api/v1/newsletter/unsubscribe') &&
          response.request().method() === 'POST',
      );
      await newsletter
        .getByRole('button', { name: '配信停止する', exact: true })
        .click();
      expect((await unsubscribe).ok()).toBe(true);
      await expect(
        newsletter.getByText('メールマガジンの配信を停止しました', {
          exact: true,
        }),
      ).toBeVisible();
      await newsletter.goto(link);
      await expect(
        newsletter.getByText('すでに配信停止手続きが完了しています', {
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        newsletter.getByRole('button', { name: '配信停止する', exact: true }),
      ).toHaveCount(0);
      await newsletter.goto('/newsletter/unsubscribe?token=invalid');
      await expect(
        newsletter.getByText('このリンクは無効、または有効期限が切れています', {
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        newsletter.getByRole('button', { name: '配信停止する', exact: true }),
      ).toHaveCount(0);
      await newsletter.goto('/newsletter/unsubscribe');
      await expect(
        newsletter.getByText('このリンクは無効、または有効期限が切れています', {
          exact: true,
        }),
      ).toBeVisible();

      const refreshed = page.waitForResponse(
        (response) =>
          response.url().endsWith('/api/v1/customer/preferences/newsletter') &&
          response.request().method() === 'GET',
      );
      await page.bringToFront();
      await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      expect((await refreshed).ok()).toBe(true);
      await expect(page.getByText('現在：配信停止中')).toBeVisible();
      const subscribeAgain = page.getByRole('button', {
        name: '購読する',
        exact: true,
      });
      await expect(subscribeAgain).toBeDisabled();
      const withoutConsent = await page.request.patch(
        '/api/v1/customer/preferences/newsletter',
        {
          data: { subscribed: true },
          headers: { Origin: new URL(page.url()).origin },
        },
      );
      expect(withoutConsent.status()).toBe(422);
      expect((await withoutConsent.json()).error.code).toBe('VALIDATION_ERROR');
      const stillUnsubscribed = await page.request.get(
        '/api/v1/customer/preferences/newsletter',
      );
      expect((await stillUnsubscribed.json()).data.subscribed).toBe(false);
      await page
        .getByRole('checkbox', { name: 'メールマガジンの配信に同意します。' })
        .check();
      const resubscribe = page.waitForResponse(
        (response) =>
          response.url().endsWith('/api/v1/customer/preferences/newsletter') &&
          response.request().method() === 'PATCH',
      );
      await subscribeAgain.click();
      expect((await resubscribe).ok()).toBe(true);
      await expect(page.getByText('現在：購読中')).toBeVisible();
    } finally {
      // Reconcile only the fixed fixture's preference through the authenticated API.
      const restored = await page.request.patch(
        '/api/v1/customer/preferences/newsletter',
        {
          data: originalSubscribed
            ? { subscribed: true, consent: true }
            : { subscribed: false },
          headers: { Origin: new URL(page.url()).origin },
        },
      );
      expect(restored.ok()).toBe(true);
      if (originalFixture) {
        await database.newsletterSubscription.update({
          where: { email: E2E_FIXTURES.customer.email },
          data: { unsubscribeTokenHash: originalFixture.unsubscribeTokenHash },
        });
      }
      await database.$disconnect();
      await anonymous.close();
    }
  });
});
