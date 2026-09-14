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
  ] as const;
  return (
    <main className="wrap py-16">
      <p className="eyebrow">Email preview · OWNER only</p>
      <h1 className="serif mt-4 text-4xl">メールテンプレート</h1>
      <div className="mt-10 space-y-12">
        {examples.map(([template, payload]) => {
          const rendered = templates.render(template, payload);
          return (
            <section key={template}>
              <h2 className="mb-4 font-semibold">{rendered.subject}</h2>
              <iframe
                title={rendered.subject}
                className="h-[520px] w-full border bg-white"
                srcDoc={rendered.html}
              />
            </section>
          );
        })}
      </div>
    </main>
  );
}
