import type { Metadata } from 'next';
import {
  LegalPolicyPage,
  PendingLegalInformation,
} from '@/components/legal-policy-page';
import { siteConfig } from '@/config/site';

export const metadata: Metadata = {
  title: '特定商取引法に基づく表記 | LINXAS',
};

export default function TokushoPage() {
  return (
    <LegalPolicyPage
      eyebrow="Specified Commercial Transactions"
      title="特定商取引法に基づく表記"
      introduction="オンライン販売の開始前に、販売条件と事業者情報を確定して掲載します。確認中の項目は推測で補わず、その旨を明記しています。"
      sections={[
        {
          heading: '販売事業者情報',
          rows: [
            {
              label: '販売事業者',
              value: (
                <PendingLegalInformation>正式な法人名</PendingLegalInformation>
              ),
            },
            {
              label: '運営責任者',
              value: <PendingLegalInformation>氏名</PendingLegalInformation>,
            },
            {
              label: '所在地',
              value: (
                <PendingLegalInformation>
                  販売事業者の正式所在地
                </PendingLegalInformation>
              ),
            },
            {
              label: '店舗所在地',
              value: siteConfig.address.full,
            },
            {
              label: '連絡先',
              value: (
                <>
                  TEL {siteConfig.phone.display}
                  <br />
                  <PendingLegalInformation>
                    販売用メールアドレス
                  </PendingLegalInformation>
                </>
              ),
            },
            {
              label: '酒類販売免許',
              value: '通信販売酒類小売業免許取得済',
            },
          ],
        },
        {
          heading: '販売条件',
          rows: [
            {
              label: '販売価格',
              value: '各商品ページに税込価格を表示します。',
            },
            {
              label: '商品代金以外の費用',
              value: (
                <PendingLegalInformation>
                  正式な送料・各種手数料
                </PendingLegalInformation>
              ),
            },
            {
              label: '支払方法・支払時期',
              value: (
                <PendingLegalInformation>
                  契約する決済手段と課金時期
                </PendingLegalInformation>
              ),
            },
            {
              label: '商品引渡時期',
              value: (
                <PendingLegalInformation>
                  受注後の発送日数と例外条件
                </PendingLegalInformation>
              ),
            },
            {
              label: '返品・キャンセル',
              value: (
                <PendingLegalInformation>
                  返品条件、期限、送料負担、キャンセル条件
                </PendingLegalInformation>
              ),
            },
          ],
        },
      ]}
    />
  );
}
