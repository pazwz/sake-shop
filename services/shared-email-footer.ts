import {
  emailBrandConfig,
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
  `<a href="${escapeHtml(toEmailPublicUrl(href))}" style="display:inline-block;padding:3px 0;color:#6f1831;text-decoration:underline;overflow-wrap:break-word">${escapeHtml(label)}</a>`;
const linkText = ({ label, href }: FooterLink) =>
  `${label}: ${toEmailPublicUrl(href)}`;

export function SharedEmailFooter({
  variant = 'transactional',
  unsubscribeUrl = null,
  testMode = false,
}: SharedEmailFooterOptions = {}): { html: string; text: string } {
  const contact = { label: 'お問い合わせ', href: '/contact' };
  const phone = {
    label: emailBrandConfig.phone.display,
    href: emailBrandConfig.phone.href,
  };
  const instagram = { label: 'Instagram', href: emailBrandConfig.instagramUrl };
  const unsubscribe =
    variant === 'newsletter' && !testMode && unsubscribeUrl
      ? { label: 'メールマガジンの配信停止はこちら', href: unsubscribeUrl }
      : null;
  const testNotice =
    variant === 'newsletter' && testMode
      ? 'これはテストメールです。このテストメールには有効な配信停止リンクは含まれていません。'
      : null;
  const copyright = `© ${new Date().getFullYear()} LINXAS FUKUOKA`;
  const row = (content: string) =>
    `<tr><td style="padding:12px 0">${content}</td></tr>`;
  return {
    html: `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;margin-top:40px;border-top:1px solid #e7e1d8;background:#faf8f4;font-size:13px;line-height:1.9;color:#171412"><tbody><tr><td style="padding:24px 16px"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%"><tbody>${row('<p style="margin:0;font-family:Georgia,serif;font-size:22px;letter-spacing:.12em">LINXAS FUKUOKA</p>')}${row(`${link(contact)}<br>${link(phone)}<br>営業時間：${escapeHtml(emailBrandConfig.businessHours)}`)}${row(link(instagram))}${row(emailBrandConfig.legalLinks.map(link).join('<br>'))}${unsubscribe ? row(link(unsubscribe)) : ''}${testNotice ? row(escapeHtml(testNotice)) : ''}${row(escapeHtml(emailBrandConfig.sentOnlyNotice).replaceAll('\n', '<br>'))}${row(escapeHtml(emailBrandConfig.ageNotice))}${row(escapeHtml(copyright))}</tbody></table></td></tr></tbody></table>`,
    text: [
      'LINXAS FUKUOKA',
      `${linkText(contact)}\n${linkText(phone)}\n営業時間：${emailBrandConfig.businessHours}`,
      linkText(instagram),
      emailBrandConfig.legalLinks.map(linkText).join('\n'),
      ...(unsubscribe ? [linkText(unsubscribe)] : []),
      ...(testNotice ? [testNotice] : []),
      emailBrandConfig.sentOnlyNotice,
      emailBrandConfig.ageNotice,
      copyright,
    ].join('\n\n'),
  };
}
