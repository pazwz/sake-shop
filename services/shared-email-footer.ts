import {
  emailBrandConfig,
  EMAIL_SITE_URL,
  toEmailPublicUrl,
} from '@/config/email-brand-config';

type FooterLink = { label: string; href: string };
type SharedEmailFooterOptions = {
  variant?: 'transactional' | 'newsletter';
  unsubscribeUrl?: string | null;
  testMode?: boolean;
};

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

const link = ({ label, href }: FooterLink) =>
  `<a href="${escapeHtml(toEmailPublicUrl(href))}" style="color:#6f1831;text-decoration:underline;line-height:2;overflow-wrap:break-word">${escapeHtml(label)}</a>`;

const linkText = ({ label, href }: FooterLink) =>
  `${label}: ${toEmailPublicUrl(href)}`;

export function SharedEmailFooter({
  variant = 'transactional',
  unsubscribeUrl = null,
  testMode = false,
}: SharedEmailFooterOptions = {}): { html: string; text: string } {
  const newsletter = variant === 'newsletter';
  const groups = [
    ...(newsletter
      ? [{ title: 'SHOP', links: emailBrandConfig.shopLinks }]
      : []),
    { title: 'SERVICE', links: emailBrandConfig.serviceLinks },
    { title: 'SUPPORT', links: [{ label: 'お問い合わせ', href: '/contact' }] },
    {
      title: 'FOLLOW',
      links: [{ label: 'Instagram', href: emailBrandConfig.instagramUrl }],
    },
  ];
  const support = `電話：${emailBrandConfig.phone.display} ／ 営業時間：${emailBrandConfig.businessHours}`;
  const subscriptionNote = testMode
    ? 'これはテストメールです。\nニュースレター配信内容の確認のために送信されています。\nこのテストメールには有効な配信停止リンクは含まれていません。'
    : 'このメールは、LINXASのニュースレター配信にご登録いただいたお客さまへお送りしています。';
  const unsubscribe =
    newsletter && !testMode && unsubscribeUrl
      ? { label: 'メールマガジンの配信停止はこちら', href: unsubscribeUrl }
      : null;
  const registration = { label: 'メールマガジンのご登録', href: '/newsletter' };
  const copyright = `© ${new Date().getFullYear()} LINXAS FUKUOKA`;
  const rows = groups
    .map(
      ({ title, links }) =>
        `<tr><td style="padding:12px 0;border-bottom:1px solid #e7e1d8"><p style="margin:0 0 4px;font-size:11px;font-weight:600;letter-spacing:.14em;color:#6f1831">${title}</p>${links.map(link).join('<br>')}${title === 'SUPPORT' ? `<p style="margin:6px 0 0">${link({ label: emailBrandConfig.phone.display, href: emailBrandConfig.phone.href })}<br>営業時間：${escapeHtml(emailBrandConfig.businessHours)}</p>` : ''}</td></tr>`,
    )
    .join('');
  return {
    html: `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;margin-top:32px;border-top:1px solid #d9d1c6;background:#faf8f4;font-size:12px;line-height:1.85;color:#514a43"><tbody><tr><td style="padding:20px 16px"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%"><tbody><tr><td style="padding-bottom:12px"><p style="margin:0;font-family:Georgia,serif;font-size:22px;letter-spacing:.12em;color:#6f1831">LINXAS</p><p style="margin:4px 0 0">LINXAS / ${escapeHtml(emailBrandConfig.storeName)} / FUKUOKA</p>${link({ label: 'オンラインショップ', href: EMAIL_SITE_URL })}</td></tr>${rows}${newsletter ? `<tr><td style="padding:16px 0;border-bottom:1px solid #e7e1d8"><p style="margin:0 0 8px;font-size:11px;font-weight:600;letter-spacing:.14em;color:#6f1831">NEWSLETTER</p><p style="margin:0 0 8px">季節の便りと、新しい一本をお届けします。</p>${link(registration)}<p style="margin:12px 0 0">${escapeHtml(subscriptionNote).replaceAll('\n', '<br>')}</p>${unsubscribe ? `<p style="margin:12px 0 0">${link(unsubscribe)}</p>` : ''}</td></tr>` : ''}<tr><td style="padding-top:16px">${emailBrandConfig.legalLinks.map(link).join('<br>')}<p style="margin:16px 0 0">${escapeHtml(emailBrandConfig.sentOnlyNotice)}</p><p style="margin:12px 0 0">${emailBrandConfig.ageNotices.map(escapeHtml).join('<br>')}</p><p style="margin:12px 0 0;font-size:11px;color:#746b62">${copyright}</p></td></tr></tbody></table></td></tr></tbody></table>`,
    text: [
      `LINXAS / ${emailBrandConfig.storeName} / FUKUOKA`,
      EMAIL_SITE_URL,
      ...groups.map(
        ({ title, links }) =>
          `${title}\n${links.map(linkText).join('\n')}${title === 'SUPPORT' ? `\n${support}` : ''}`,
      ),
      ...(newsletter
        ? [
            'NEWSLETTER\n季節の便りと、新しい一本をお届けします。',
            linkText(registration),
            subscriptionNote,
            ...(unsubscribe ? [linkText(unsubscribe)] : []),
          ]
        : []),
      emailBrandConfig.legalLinks.map(linkText).join('\n'),
      emailBrandConfig.sentOnlyNotice,
      emailBrandConfig.ageNotices.join('\n'),
      copyright,
    ].join('\n\n'),
  };
}
