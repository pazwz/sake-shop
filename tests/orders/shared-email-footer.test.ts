import assert from 'node:assert/strict';
import test from 'node:test';
import { EmailTemplate } from '@prisma/client';
import { Resend } from 'resend';
import { createEmailActionToken } from '@/lib/email-action-token';
import { EmailTemplateService } from '@/services/email-template.service';
import { ResendEmailAdapter } from '@/services/email-adapters/resend-email.adapter';
import type { EmailMessage } from '@/types/email';

const templates = new EmailTemplateService();
const canonical = 'https://linxas-fukuoka.com';
const commonPayload = {
  tokenId: 'preview-token',
  customerName: '<山田>',
  orderNumber: 'ORDER-1',
  carrier: 'SAGAWA',
  trackingNumber: 'TEST123',
  totalAmount: 1000,
};

test('formal newsletter retry keeps exactly the same provider body and unsubscribe headers', () => {
  const payload = {
    subject: 'preview',
    body: 'preview',
    newsletterSubscriptionId: 'offline-preview',
  };
  const first = templates.render(EmailTemplate.NEWSLETTER_CAMPAIGN, payload);
  const second = templates.render(EmailTemplate.NEWSLETTER_CAMPAIGN, payload);
  assert.ok(first.html === second.html);
  assert.ok(first.text === second.text);
  assert.ok(JSON.stringify(first.headers) === JSON.stringify(second.headers));
});

test('every transactional email includes safe shared legal, support and age footer without marketing unsubscribe', () => {
  for (const template of Object.values(EmailTemplate).filter(
    (value) => value !== EmailTemplate.NEWSLETTER_CAMPAIGN,
  )) {
    const rendered = templates.render(template, commonPayload);
    for (const path of ['/contact', '/legal/tokusho', '/privacy', '/terms']) {
      assert.ok(
        rendered.html.includes(`${canonical}${path}`),
        `${template}: ${path}`,
      );
      assert.ok(
        rendered.text.includes(`${canonical}${path}`),
        `${template} text: ${path}`,
      );
    }
    for (const content of [
      '送信専用',
      '20歳未満の方への酒類の販売はいたしません。',
      '092-285-8022',
      '11:00-20:00',
      'Instagram',
      '©',
    ]) {
      assert.ok(rendered.html.includes(content), `${template}: ${content}`);
      assert.ok(
        rendered.text.includes(content),
        `${template} text: ${content}`,
      );
    }
    assert.match(rendered.html, /<table[^>]+role="presentation"/);
    for (const content of [rendered.html, rendered.text]) {
      assert.equal((content.match(/20歳未満/g) ?? []).length, 1);
      assert.doesNotMatch(
        content,
        /SHOP|SERVICE|SUPPORT|FOLLOW|shipping-returns/,
      );
    }
    assert.doesNotMatch(
      rendered.html,
      /display:\s*(flex|grid)|<script|<style|<link|\/legal\/alcohol|\/faq|\/payment|youtube|twitter|line\.me/i,
    );
    assert.doesNotMatch(rendered.html, /gest22|大名1-1-7/);
    assert.equal(
      (rendered.html.match(/<table\b/g) ?? []).length,
      (rendered.html.match(/<\/table>/g) ?? []).length,
    );
    assert.doesNotMatch(
      rendered.html,
      /newsletter\/unsubscribe|products\?group=/,
    );
    assert.equal(rendered.headers, undefined);
    assert.ok(Buffer.byteLength(rendered.html) < 100_000);
  }
});

test('public action URLs ignore deployment configuration and keep verification/reset token behavior', () => {
  const previous = process.env.NEXT_PUBLIC_SITE_URL;
  process.env.NEXT_PUBLIC_SITE_URL = 'https://preview.example.com';
  try {
    for (const [template, path] of [
      [EmailTemplate.EMAIL_VERIFICATION, '/verify-email'],
      [EmailTemplate.PASSWORD_RESET, '/reset-password'],
      [
        EmailTemplate.ORDER_MESSAGE_NOTIFICATION,
        '/account/orders/ORDER-1/messages',
      ],
    ] as const) {
      const rendered = templates.render(template, commonPayload);
      assert.ok(rendered.html.includes(`${canonical}${path}`));
      assert.doesNotMatch(rendered.html, /preview\.example\.com/);
      if (template !== EmailTemplate.ORDER_MESSAGE_NOTIFICATION) {
        const purpose =
          template === EmailTemplate.EMAIL_VERIFICATION
            ? 'verify-email'
            : 'reset-password';
        const expected = createEmailActionToken('preview-token', purpose);
        assert.ok(
          rendered.html.includes(`token=${encodeURIComponent(expected)}`),
        );
      }
    }
  } finally {
    if (previous === undefined)
      Reflect.deleteProperty(process.env, 'NEXT_PUBLIC_SITE_URL');
    else process.env.NEXT_PUBLIC_SITE_URL = previous;
  }
});

test('formal newsletter retains unsubscribe and canonical campaign CTAs without a shop sitemap', () => {
  const rendered = templates.render(EmailTemplate.NEWSLETTER_CAMPAIGN, {
    subject: '秋のお知らせ',
    body: '<本文>',
    newsletterSubscriptionId: 'subscription-preview',
    ctaLabel: '商品を見る',
    ctaUrl: '/products?group=sake',
    sections: [
      { ctaLabel: '特集を見る', ctaUrl: '/collections/autumn' },
      { ctaLabel: '外部', ctaUrl: 'https://campaign.example.com/autumn' },
    ],
  });
  for (const content of [rendered.html, rendered.text]) {
    assert.doesNotMatch(
      content,
      /SHOP|SERVICE|whisky|wine-champagne|shochu|brandy-spirits/,
    );
    assert.equal((content.match(/20歳未満/g) ?? []).length, 1);
  }
  assert.match(rendered.html, /メールマガジンの配信停止はこちら/);
  assert.match(rendered.text, /メールマガジンの配信停止はこちら/);
  const href = rendered.html.match(
    /href="([^"]+\/newsletter\/unsubscribe\?token=[^"]+)"/,
  )?.[1];
  assert.ok(href?.startsWith(`${canonical}/newsletter/unsubscribe?token=`));
  assert.equal(
    rendered.headers?.['List-Unsubscribe'],
    `<${canonical}/api/v1/newsletter/unsubscribe/one-click?token=${new URL(href!).searchParams.get('token')}>`,
  );
  assert.equal(
    rendered.headers?.['List-Unsubscribe-Post'],
    'List-Unsubscribe=One-Click',
  );
  assert.ok(rendered.html.includes(`${canonical}/collections/autumn`));
  assert.ok(rendered.text.includes(`${canonical}/collections/autumn`));
  assert.ok(rendered.html.includes('https://campaign.example.com/autumn'));
  assert.ok(rendered.html.includes('&lt;本文&gt;'));
  assert.ok(Buffer.byteLength(rendered.html) < 100_000);
});

test('test newsletters never expose functional unsubscribe links or one-click headers even with a subscription ID', () => {
  const rendered = templates.render(EmailTemplate.NEWSLETTER_CAMPAIGN, {
    testMode: true,
    newsletterSubscriptionId: 'subscription-preview',
    body: 'テスト',
  });
  assert.ok(
    rendered.html.includes(
      'このテストメールには有効な配信停止リンクは含まれていません。',
    ),
  );
  assert.doesNotMatch(rendered.html, /newsletter\/unsubscribe\?token=/);
  assert.equal(rendered.headers, undefined);
});

test('Resend forwards newsletter headers only when supplied without contacting the provider', async (context) => {
  const requests: Record<string, unknown>[] = [];
  context.mock.method(
    Resend.prototype,
    'post',
    async (_path: string, body: Record<string, unknown>) => {
      requests.push(body);
      return { data: { id: 'offline-message' }, error: null };
    },
  );
  const adapter = new ResendEmailAdapter('offline-key', 'no-reply@example.com');
  const message: EmailMessage = {
    to: 'preview@example.com',
    subject: 'Preview',
    html: '<p>Preview</p>',
    text: 'Preview',
    idempotencyKey: 'offline-preview',
  };
  await adapter.send(message);
  const headers = {
    'List-Unsubscribe':
      '<https://linxas-fukuoka.com/api/v1/newsletter/unsubscribe/one-click?token=dummy>',
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
  await adapter.send({ ...message, headers });
  assert.equal(requests[0].headers, undefined);
  assert.deepEqual(requests[1].headers, headers);
});
