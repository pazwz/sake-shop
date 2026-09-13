import type { Metadata } from 'next';
import {
  LegalPolicyPage,
  PendingLegalInformation,
} from '@/components/legal-policy-page';

export const metadata: Metadata = {
  title: 'プライバシーポリシー | LINXAS',
};

export default function PrivacyPage() {
  return (
    <LegalPolicyPage
      eyebrow="Privacy"
      title="プライバシーポリシー"
      introduction="LINXASのオンラインサービスにおける個人情報の取扱方針です。正式な販売事業者情報と保存期間は、オンライン販売開始前に確定します。"
      sections={[
        {
          heading: '取得する情報',
          items: [
            '会員登録時の氏名、メールアドレスおよび認証情報',
            '注文時の配送先、電話番号、購入内容および注文履歴',
            'お問い合わせ内容およびサービス利用に伴う技術情報',
          ],
        },
        {
          heading: '利用目的',
          items: [
            '商品の販売、配送、決済およびアフターサポート',
            '本人確認、不正利用防止およびセキュリティ確保',
            'お問い合わせ対応とサービス品質の改善',
            '法令上必要な記録の作成と保存',
          ],
        },
        {
          heading: '第三者提供・委託',
          paragraphs: [
            '法令に基づく場合を除き、本人の同意なく個人情報を第三者へ提供しません。配送、決済、システム運用などに必要な範囲で委託する場合は、委託先を適切に管理します。',
          ],
        },
        {
          heading: '安全管理とお問い合わせ',
          paragraphs: [
            '個人情報への不正アクセス、紛失、改ざんおよび漏えいを防ぐため、合理的な安全管理措置を講じます。開示、訂正、利用停止等のご相談は、お問い合わせ窓口で受け付けます。',
          ],
          rows: [
            {
              label: '個人情報取扱事業者',
              value: (
                <PendingLegalInformation>正式な法人名</PendingLegalInformation>
              ),
            },
            {
              label: '保存期間',
              value: (
                <PendingLegalInformation>
                  情報区分ごとの保存期間
                </PendingLegalInformation>
              ),
            },
          ],
        },
      ]}
    />
  );
}
