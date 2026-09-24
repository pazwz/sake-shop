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
  options: { includeDefaultFooter?: boolean } = {},
): EmailTemplateResult => ({
  subject: title,
  html: `<!doctype html><html lang="ja"><body style="margin:0;background:#f6f3ee;color:#171412;font-family:-apple-system,BlinkMacSystemFont,'Hiragino Kaku Gothic ProN',sans-serif"><div style="max-width:620px;margin:0 auto;padding:48px 24px"><div style="background:#fff;padding:40px 32px"><p style="letter-spacing:.28em;color:#6f1831;font-size:12px">LINXAS</p><h1 style="font-family:serif;font-weight:400;font-size:28px">${escapeHtml(title)}</h1>${body}${options.includeDefaultFooter === false ? '' : `<hr style="border:0;border-top:1px solid #e7e1d8;margin:32px 0"><p style="font-size:12px;line-height:1.8;color:#777">${escapeHtml(siteConfig.storeName)}<br>20歳未満の者の飲酒は法律で禁止されています。</p>`}</div></div></body></html>`,
  text: `${title}\n\n${text}${options.includeDefaultFooter === false ? '' : `\n\n${siteConfig.storeName}\n20歳未満の者の飲酒は法律で禁止されています。`}`,
});

const button = (label: string, url: string) =>
  `<p style="margin:28px 0"><a href="${escapeHtml(url)}" style="display:inline-block;background:#6f1831;color:#fff;text-decoration:none;padding:14px 24px">${escapeHtml(label)}</a></p>`;

const isSafeNewsletterUrl = (value: string) =>
  /^\/(?:products|collections)(?:\/|$)/.test(value) ||
  /^https:\/\//i.test(value);

const renderNewsletterSections = (value: unknown) => {
  if (!Array.isArray(value)) return { html: '', text: '' };
  const sections = value
    .filter(
      (section): section is Record<string, unknown> =>
        Boolean(section) && typeof section === 'object',
    )
    .map((section) => {
      const imageUrl =
        typeof section.imageUrl === 'string' ? section.imageUrl : null;
      const imageAlt =
        typeof section.imageAlt === 'string' ? section.imageAlt : '';
      const headline =
        typeof section.headline === 'string' ? section.headline : null;
      const body = typeof section.body === 'string' ? section.body : null;
      const ctaLabel =
        typeof section.ctaLabel === 'string' ? section.ctaLabel : null;
      const ctaUrl =
        typeof section.ctaUrl === 'string' &&
        isSafeNewsletterUrl(section.ctaUrl)
          ? section.ctaUrl
          : null;
      if (!imageUrl && !headline && !body && !(ctaLabel && ctaUrl)) return null;
      const html = `${imageUrl ? `<p><img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(imageAlt)}" style="display:block;width:100%;height:auto"></p>` : ''}${headline ? `<h2 style="font-family:serif;font-weight:400;font-size:24px">${escapeHtml(headline)}</h2>` : ''}${body ? `<p style="line-height:1.9">${escapeHtml(body).replaceAll('\n', '<br>')}</p>` : ''}${ctaLabel && ctaUrl ? button(ctaLabel, ctaUrl) : ''}`;
      const text = `${headline ?? ''}${headline && body ? '\n\n' : ''}${body ?? ''}${ctaLabel && ctaUrl ? `\n\n${ctaLabel}: ${ctaUrl}` : ''}`;
      return { html, text };
    })
    .filter((section): section is { html: string; text: string } =>
      Boolean(section),
    );
  return {
    html: sections.map((section) => section.html).join(''),
    text: sections
      .map((section) => section.text)
      .filter(Boolean)
      .join('\n\n'),
  };
};

const newsletterFooter = (
  siteUrl: string,
  unsubscribeUrl: string | null,
  testMode: boolean,
) => {
  const contactUrl = `${siteUrl}/contact`;
  const privacyUrl = `${siteUrl}/privacy`;
  const tokushoUrl = `${siteUrl}/legal/tokusho`;
  const subscriptionNote = testMode
    ? 'これはテストメールです。<br>ニュースレター配信内容の確認のために送信されています。<br>このテストメールには有効な配信停止リンクは含まれていません。'
    : 'このメールは、LINXASのニュースレター配信にご登録いただいたお客さまへお送りしています。';
  const subscriptionText = testMode
    ? 'これはテストメールです。\nニュースレター配信内容の確認のために送信されています。\nこのテストメールには有効な配信停止リンクは含まれていません。'
    : 'このメールは、LINXASのニュースレター配信にご登録いただいたお客さまへお送りしています。';
  const unsubscribe = unsubscribeUrl
    ? `<p style="margin:16px 0 0"><a href="${escapeHtml(unsubscribeUrl)}" style="color:#6f1831;text-decoration:underline">配信停止はこちら</a></p>`
    : '';
  return {
    html: `<footer style="margin-top:48px;padding-top:24px;border-top:1px solid #d9d1c6;font-size:12px;line-height:1.85;color:#6d665f"><p style="margin:0;color:#171412;font-weight:600;letter-spacing:.08em">LINXAS / ${escapeHtml(siteConfig.storeName)}</p><p style="margin:8px 0 0"><a href="${escapeHtml(siteUrl)}" style="color:#6f1831;text-decoration:none">${escapeHtml(siteUrl)}</a><span style="color:#b8aea2"> ｜ </span><a href="${escapeHtml(contactUrl)}" style="color:#6f1831;text-decoration:none">お問い合わせ</a></p><p style="margin:20px 0 0">${subscriptionNote}</p>${unsubscribe}<p style="margin:20px 0 0"><a href="${escapeHtml(privacyUrl)}" style="color:#6f1831;text-decoration:none">プライバシーポリシー</a><span style="color:#b8aea2"> ｜ </span><a href="${escapeHtml(tokushoUrl)}" style="color:#6f1831;text-decoration:none">特定商取引法に基づく表記</a></p><p style="margin:20px 0 0;color:#4d4741">20歳未満の者の飲酒は法律で禁止されています。</p></footer>`,
    text: `LINXAS / ${siteConfig.storeName}\n${siteUrl} ｜ お問い合わせ: ${contactUrl}\n\n${subscriptionText}${unsubscribeUrl ? `\n\n配信停止はこちら: ${unsubscribeUrl}` : ''}\n\nプライバシーポリシー: ${privacyUrl} ｜ 特定商取引法に基づく表記: ${tokushoUrl}\n\n20歳未満の者の飲酒は法律で禁止されています。`,
  };
};

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
    if (template === EmailTemplate.CONTACT_INQUIRY) {
      return frame(
        '[LINXAS EC] 新しいお問い合わせがあります',
        `<p>サイト内に新しいお問い合わせがあります。</p><p>注文番号：${escapeHtml(payload.orderNumber)}</p><p>管理画面より内容をご確認ください。</p><p>※このメールは送信専用です。メールへの返信は受け付けていません。</p>`,
        `サイト内に新しいお問い合わせがあります。\n注文番号: ${payload.orderNumber}\n管理画面より内容をご確認ください。\n\nこのメールは送信専用です。メールへの返信は受け付けていません。`,
      );
    }
    if (template === EmailTemplate.ORDER_MESSAGE_NOTIFICATION) {
      const orderNumber = String(payload.orderNumber ?? '');
      const url = `${siteUrl}/account/orders/${encodeURIComponent(orderNumber)}/messages`;
      return frame(
        '【LINXAS】新しいメッセージがあります',
        `<p>${name} 様</p><p>ご注文に関する新しいメッセージがあります。</p><p>注文番号：${escapeHtml(orderNumber)}</p>${button('メッセージを確認する', url)}<p>※このメールは送信専用です。メールに直接返信いただいても回答できません。</p>`,
        `${payload.customerName ?? 'お客様'} 様\n\nご注文に関する新しいメッセージがあります。\n注文番号: ${orderNumber}\n\nMY PAGEより内容をご確認ください。\n${url}\n\nこのメールは送信専用です。メールに直接返信いただいても回答できません。`,
      );
    }
    if (template === EmailTemplate.CONTACT_REPLY) {
      const publicId = escapeHtml(payload.publicId);
      const replyBody = escapeHtml(payload.body).replaceAll('\n', '<br>');
      return frame(
        String(
          payload.subject ?? `[LINXAS] お問い合わせについて（${publicId}）`,
        ),
        `<p>${name} 様</p><p>お問い合わせいただきありがとうございます。</p><p>${replyBody}</p><p>お問い合わせ番号：${publicId}</p><p>----------------<br>LINXAS / ${escapeHtml(siteConfig.storeName)}<br>お問い合わせ窓口<br>${escapeHtml(siteUrl)}</p>`,
        `${payload.customerName ?? 'お客様'} 様\n\nお問い合わせいただきありがとうございます。\n\n${payload.body ?? ''}\n\nお問い合わせ番号：${payload.publicId ?? ''}\n\n----------------\nLINXAS / ${siteConfig.storeName}\nお問い合わせ窓口\n${siteUrl}`,
      );
    }
    if (template === EmailTemplate.NEWSLETTER_CAMPAIGN) {
      const subject = String(payload.subject ?? 'LINXASからのお知らせ');
      const preheader = String(payload.preheader ?? '');
      const headline = String(payload.headline ?? subject);
      const bodyText = String(payload.body ?? '');
      const heroImageUrl = payload.heroImageUrl
        ? String(payload.heroImageUrl)
        : null;
      const heroImageAlt = String(payload.heroImageAlt ?? '');
      const ctaLabel = payload.ctaLabel ? String(payload.ctaLabel) : null;
      const ctaUrl = payload.ctaUrl ? String(payload.ctaUrl) : null;
      const testMode = payload.testMode === true;
      const subscriptionId = payload.newsletterSubscriptionId
        ? String(payload.newsletterSubscriptionId)
        : null;
      const unsubscribeUrl =
        !testMode && subscriptionId
          ? `${siteUrl}/newsletter/unsubscribe?token=${encodeURIComponent(
              createEmailActionToken(subscriptionId, 'newsletter-unsubscribe'),
            )}`
          : null;
      const escapedBody = escapeHtml(bodyText).replaceAll('\n', '<br>');
      const hero = heroImageUrl
        ? `<p><img src="${escapeHtml(heroImageUrl)}" alt="${escapeHtml(heroImageAlt)}" style="display:block;width:100%;height:auto"></p>`
        : '';
      const cta = ctaLabel && ctaUrl ? button(ctaLabel, ctaUrl) : '';
      const sections = renderNewsletterSections(payload.sections);
      const footer = newsletterFooter(siteUrl, unsubscribeUrl, testMode);
      return frame(
        subject,
        `${preheader ? `<p style="font-size:12px;color:#777">${escapeHtml(preheader)}</p>` : ''}${hero}<h2 style="font-family:serif;font-weight:400;font-size:24px">${escapeHtml(headline)}</h2><p style="line-height:1.9">${escapedBody}</p>${cta}${sections.html}${footer.html}`,
        `${preheader ? `${preheader}\n\n` : ''}${headline}\n\n${bodyText}${ctaLabel && ctaUrl ? `\n\n${ctaLabel}: ${ctaUrl}` : ''}${sections.text ? `\n\n${sections.text}` : ''}\n\n${footer.text}`,
        { includeDefaultFooter: false },
      );
    }
    const titles: Partial<Record<EmailTemplate, string>> = {
      PAYMENT_SUCCEEDED: 'お支払いを確認しました',
      PAYMENT_FAILED: 'お支払いを確認できませんでした',
      ORDER_CANCELLED: 'ご注文をキャンセルしました',
      CONTACT_INQUIRY: '[LINXAS EC] お問い合わせ',
    };
    const title = titles[template] ?? 'LINXASからのお知らせ';
    return frame(
      title,
      `<p>注文番号：${escapeHtml(payload.orderNumber)}</p><p>合計：¥${escapeHtml(payload.totalAmount)}</p>`,
      `注文番号: ${payload.orderNumber}\n合計: ¥${payload.totalAmount}`,
    );
  }
}
