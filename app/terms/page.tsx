import type { Metadata } from 'next';
import { LegalPolicyPage } from '@/components/legal-policy-page';

export const metadata: Metadata = {
  title: '利用規約 | LINXAS',
};

export default function TermsPage() {
  return (
    <LegalPolicyPage
      eyebrow="Terms"
      title="利用規約"
      introduction="本規約は、LINXASオンラインサービスの利用条件を定めるものです。現在オンライン注文は準備中であり、販売開始時に確定版へ更新します。"
      sections={[
        {
          heading: 'サービスの利用',
          items: [
            '利用者は、正確な情報を登録し、認証情報を適切に管理してください。',
            '不正アクセス、第三者へのなりすまし、転売目的その他当店が不適切と判断する利用を禁止します。',
            'システム保守、障害または法令対応のため、サービスの全部または一部を停止する場合があります。',
          ],
        },
        {
          heading: '酒類の購入',
          paragraphs: [
            '20歳未満の方は酒類を購入できません。注文時に年齢確認を行い、必要に応じて本人確認をお願いする場合があります。',
          ],
        },
        {
          heading: '注文・契約の成立',
          paragraphs: [
            '注文受付、在庫確保、決済および売買契約の成立時期に関する正式条件は、決済事業者と運用手順の確定後、オンライン販売開始前に掲載します。',
          ],
        },
        {
          heading: '知的財産・免責',
          paragraphs: [
            'サイト内の文章、画像、商標等の権利は各権利者に帰属します。法令上免責が認められない場合を除き、当店の責めに帰さない通信障害や外部サービス障害による損害について責任を負いません。',
          ],
        },
        {
          heading: '準拠法・管轄',
          paragraphs: [
            '本規約は日本法に準拠します。合意管轄裁判所は、販売事業者の正式所在地とともにオンライン販売開始前に確定して掲載します。',
          ],
        },
      ]}
    />
  );
}
