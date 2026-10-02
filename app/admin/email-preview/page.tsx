import { AdminRole, EmailTemplate } from '@prisma/client';
import { EmailTemplateService } from '@/services/email-template.service';
import { requireAdmin } from '@/services/admin-authorization.service';

export default async function AdminEmailPreviewPage() {
  await requireAdmin([AdminRole.OWNER]);
  const templates = new EmailTemplateService();
  const examples = [
    [
      EmailTemplate.EMAIL_VERIFICATION,
      { tokenId: 'preview-token', customerName: '山田 太郎' },
    ],
    [
      EmailTemplate.PASSWORD_RESET,
      { tokenId: 'preview-token', customerName: '山田 太郎' },
    ],
    [
      EmailTemplate.ORDER_RECEIVED,
      {
        orderNumber: 'LINXAS-PREVIEW',
        orderedAt: '2026-09-14',
        items: [{ productName: '商品名', quantity: 1, subtotal: 10000 }],
        subtotal: 10000,
        shipping: 880,
        totalAmount: 10880,
        status: 'PENDING',
        shippingAddress: {
          prefecture: '福岡県',
          city: '福岡市',
          addressLine1: 'PREVIEW',
        },
      },
    ],
    [
      EmailTemplate.SHIPMENT_SENT,
      {
        orderNumber: 'LINXAS-PREVIEW',
        carrier: 'SAGAWA',
        trackingNumber: 'TEST123456789',
      },
    ],
    [
      EmailTemplate.ORDER_MESSAGE_NOTIFICATION,
      { orderNumber: 'LINXAS-PREVIEW', customerName: '山田 太郎' },
    ],
    [EmailTemplate.CONTACT_INQUIRY, { orderNumber: 'LINXAS-PREVIEW' }],
    [
      EmailTemplate.NEWSLETTER_CAMPAIGN,
      {
        subject: '【プレビュー】秋のおすすめ',
        headline: '季節のお酒を、暮らしに。',
        body: 'LINXASの新着商品・おすすめのお酒をご紹介します。',
        ctaLabel: '日本酒を見る',
        ctaUrl: '/products?group=sake',
        testMode: true,
      },
    ],
    [
      EmailTemplate.NEWSLETTER_CAMPAIGN,
      {
        subject: '【正式フッタープレビュー・送信なし】秋のおすすめ',
        headline: '季節のお酒を、暮らしに。',
        body: '表示確認専用です。実際の購読者への配信は行いません。',
        newsletterSubscriptionId: 'preview-only-no-subscription',
      },
    ],
  ] as const;
  return (
    <main className="wrap py-16">
      <p className="eyebrow">Email preview · Admin</p>
      <h1 className="serif mt-4 text-4xl">メールテンプレート</h1>
      <p className="mt-4 text-sm text-stone-600">
        HTML・テキストの表示確認専用です。メール送信や購読状態の変更は行いません。
      </p>
      <div className="mt-10 space-y-12">
        {examples.map(([template, payload], index) => {
          const rendered = templates.render(template, payload);
          return (
            <section key={`${template}-${index}`}>
              <h2 className="mb-4 font-semibold">{rendered.subject}</h2>
              <iframe
                title={rendered.subject}
                className="h-[1100px] w-full border bg-white"
                srcDoc={rendered.html}
                sandbox=""
              />
              <details className="mt-4">
                <summary className="cursor-pointer text-sm">テキスト版</summary>
                <pre className="mt-3 whitespace-pre-wrap break-words text-xs">
                  {rendered.text}
                </pre>
              </details>
            </section>
          );
        })}
      </div>
    </main>
  );
}
