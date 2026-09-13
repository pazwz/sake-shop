import type { Metadata } from 'next';
import { LegalPolicyPage } from '@/components/legal-policy-page';

export const metadata: Metadata = {
  title: '配送・返品について | LINXAS',
};

export default function ShippingReturnsPage() {
  return (
    <LegalPolicyPage
      eyebrow="Shipping & Returns"
      title="配送・返品について"
      introduction="現在、オンライン販売開始に向けて配送条件を最終確認しています。未確定の料金や条件を正式情報として表示しないため、確定前の内容を明示しています。"
      sections={[
        {
          heading: '配送について',
          rows: [
            { label: '配送会社', value: '佐川急便（予定）' },
            { label: '送料', value: '正式な地域別送料表を確認中です。' },
            { label: 'クール便', value: '対象商品と追加料金を確認中です。' },
            {
              label: '離島・遠隔地',
              value: '対象地域と追加料金を確認中です。',
            },
            { label: '発送時期', value: '受注後の標準発送日数を確認中です。' },
          ],
        },
        {
          heading: '返品・交換について',
          paragraphs: [
            '酒類・食品の性質上、お客様都合による返品・交換の可否、受付期限および送料負担は、正式な販売条件の確定後に掲載します。商品違い、破損その他当店の責に帰す問題がある場合は、商品を処分せず、到着後速やかにお問い合わせください。',
          ],
        },
        {
          heading: 'キャンセルについて',
          paragraphs: [
            '注文確定後のキャンセル可能時期、返金方法および手数料は、決済・出荷運用の確定後に掲載します。オンライン販売開始までは注文を受け付けていません。',
          ],
        },
      ]}
    />
  );
}
