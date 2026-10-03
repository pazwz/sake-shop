import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EmailTemplate } from '@prisma/client';
import { chromium } from '@playwright/test';
import { EmailTemplateService } from '@/services/email-template.service';

// Offline preview only: never load env files, connect to a database, or send email.
process.env.JWT_SECRET = 'local-email-preview-only-not-a-production-secret';

async function main() {
  const directory = await mkdtemp(join(tmpdir(), 'linxas-email-preview-'));
  const browser = await chromium.launch();
  const templates = new EmailTemplateService();
  const cases = [
    ['verification', EmailTemplate.EMAIL_VERIFICATION],

    ['password-reset', EmailTemplate.PASSWORD_RESET],
    ['order-received', EmailTemplate.ORDER_RECEIVED],
    ['shipment', EmailTemplate.SHIPMENT_SENT],
    ['inquiry', EmailTemplate.CONTACT_INQUIRY],
    ['newsletter', EmailTemplate.NEWSLETTER_CAMPAIGN],
  ] as const;
  try {
    for (const [name, template] of cases) {
      const rendered = templates.render(template, {
        tokenId: 'offline-preview',
        customerName: '山田 様',
        orderNumber: 'PREVIEW-ONLY',
        carrier: '配送業者',
        trackingNumber: 'PREVIEW',
        orderedAt: '2026/10/02 12:00（プレビュー）',
        status: '注文受付（プレビュー）',
        items: [
          { productName: 'プレビュー商品', quantity: 1, subtotal: 10000 },
        ],
        subtotal: 10000,
        shipping: 0,
        shippingAddress: {
          prefecture: '福岡県',
          city: '福岡市',
          addressLine1: 'プレビュー用住所',
        },
        totalAmount: 10000,
        subject: '季節の便り',
        headline: '新しい一本との出会い',
        body: 'LINXAS FUKUOKAから季節の便りをお届けします。',
        newsletterSubscriptionId: 'offline-preview-only',
      });
      await writeFile(join(directory, `${name}.html`), rendered.html);
      await writeFile(join(directory, `${name}.txt`), rendered.text);
      for (const width of [390, 900]) {
        const page = await browser.newPage({
          viewport: { width, height: 900 },
        });
        await page.route('**/*', (route) => route.abort());
        await page.setContent(rendered.html);
        if (
          await page.evaluate(
            () => document.documentElement.scrollWidth > window.innerWidth,
          )
        )
          throw new Error(`${name}: horizontal overflow at ${width}px`);
        await page.screenshot({
          path: join(directory, `${name}-${width}.png`),
          fullPage: true,
        });
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
  process.stdout.write(`Offline email previews: ${directory}\n`);
}

void main().catch(() => {
  process.stderr.write('Offline email preview failed\n');
  process.exitCode = 1;
});
