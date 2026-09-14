import { EmailTemplate } from '@prisma/client';
import { getPublicSiteUrl } from '@/config/email';
import { siteConfig } from '@/config/site';
import { createEmailActionToken } from '@/lib/email-action-token';
import type { EmailTemplateResult } from '@/types/email';

const escapeHtml = (value: unknown) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

const frame = (
  title: string,
  body: string,
  text: string,
): EmailTemplateResult => ({
  subject: title,
  html: `<!doctype html><html lang="ja"><body style="margin:0;background:#f6f3ee;color:#171412;font-family:-apple-system,BlinkMacSystemFont,'Hiragino Kaku Gothic ProN',sans-serif"><div style="max-width:620px;margin:0 auto;padding:48px 24px"><div style="background:#fff;padding:40px 32px"><p style="letter-spacing:.28em;color:#6f1831;font-size:12px">LINXAS</p><h1 style="font-family:serif;font-weight:400;font-size:28px">${escapeHtml(title)}</h1>${body}<hr style="border:0;border-top:1px solid #e7e1d8;margin:32px 0"><p style="font-size:12px;line-height:1.8;color:#777">${escapeHtml(siteConfig.storeName)}<br>20歳未満の者の飲酒は法律で禁止されています。</p></div></div></body></html>`,
  text: `${title}\n\n${text}\n\n${siteConfig.storeName}\n20歳未満の者の飲酒は法律で禁止されています。`,
});

const button = (label: string, url: string) =>
  `<p style="margin:28px 0"><a href="${escapeHtml(url)}" style="display:inline-block;background:#6f1831;color:#fff;text-decoration:none;padding:14px 24px">${escapeHtml(label)}</a></p>`;

export class EmailTemplateService {
  public render(template: EmailTemplate, payload: Record<string, unknown>) {
    const siteUrl = getPublicSiteUrl();
    const name = escapeHtml(payload.customerName ?? 'お客様');
    if (template === EmailTemplate.EMAIL_VERIFICATION) {
      const token = createEmailActionToken(
        String(payload.tokenId),
        'verify-email',
      );
      const url = `${siteUrl}/verify-email?token=${encodeURIComponent(token)}`;
      return frame(
        'メールアドレス確認のお願い',
        `<p>${name}、会員登録ありがとうございます。</p>${button('メールアドレスを確認', url)}`,
        `${payload.customerName ?? 'お客様'}、会員登録ありがとうございます。\nメールアドレスを確認: ${url}`,
      );
    }
    if (template === EmailTemplate.PASSWORD_RESET) {
      const token = createEmailActionToken(
        String(payload.tokenId),
        'reset-password',
      );
      const url = `${siteUrl}/reset-password?token=${encodeURIComponent(token)}`;
      return frame(
        'パスワード再設定',
        `<p>パスワード再設定のご依頼を受け付けました。</p>${button('パスワードを再設定', url)}`,
        `パスワードを再設定: ${url}`,
      );
    }
    if (template === EmailTemplate.WELCOME)
      return frame(
        '会員登録が完了しました',
        `<p>${name}、メールアドレスの確認が完了しました。</p>`,
        `${payload.customerName ?? 'お客様'}、メールアドレスの確認が完了しました。`,
      );
    if (template === EmailTemplate.SHIPMENT_SENT)
      return frame(
        '商品を発送しました',
        `<p>注文番号：${escapeHtml(payload.orderNumber)}</p><p>配送会社：${escapeHtml(payload.carrier)}<br>お問い合わせ番号：${escapeHtml(payload.trackingNumber)}</p>`,
        `注文番号: ${payload.orderNumber}\n配送会社: ${payload.carrier}\nお問い合わせ番号: ${payload.trackingNumber}`,
      );
    if (template === EmailTemplate.ORDER_RECEIVED) {
      const items = Array.isArray(payload.items)
        ? payload.items
            .map((item) => {
              const value = item as Record<string, unknown>;
              return `<li>${escapeHtml(value.productName)} × ${escapeHtml(value.quantity)}　¥${escapeHtml(value.subtotal)}</li>`;
            })
            .join('')
        : '';
      const address = (payload.shippingAddress ?? {}) as Record<
        string,
        unknown
      >;
      return frame(
        'ご注文を承りました',
        `<p>注文番号：${escapeHtml(payload.orderNumber)}<br>注文日時：${escapeHtml(payload.orderedAt)}<br>状態：${escapeHtml(payload.status)}</p><ul>${items}</ul><p>小計：¥${escapeHtml(payload.subtotal)}<br>送料：¥${escapeHtml(payload.shipping)}<br>合計：¥${escapeHtml(payload.totalAmount)}</p><p>配送先：${escapeHtml(address.prefecture)} ${escapeHtml(address.city)} ${escapeHtml(address.addressLine1)}</p>`,
        `注文番号: ${payload.orderNumber}\n注文日時: ${payload.orderedAt}\n小計: ¥${payload.subtotal}\n送料: ¥${payload.shipping}\n合計: ¥${payload.totalAmount}\n状態: ${payload.status}`,
      );
    }
    const titles: Partial<Record<EmailTemplate, string>> = {
      PAYMENT_SUCCEEDED: 'お支払いを確認しました',
      PAYMENT_FAILED: 'お支払いを確認できませんでした',
      ORDER_CANCELLED: 'ご注文をキャンセルしました',
    };
    const title = titles[template] ?? 'LINXASからのお知らせ';
    return frame(
      title,
      `<p>注文番号：${escapeHtml(payload.orderNumber)}</p><p>合計：¥${escapeHtml(payload.totalAmount)}</p>`,
      `注文番号: ${payload.orderNumber}\n合計: ¥${payload.totalAmount}`,
    );
  }
}
