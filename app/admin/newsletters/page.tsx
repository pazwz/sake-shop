import { AdminRole } from '@prisma/client';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { NEWSLETTER_CAMPAIGN_STATUS_LABELS } from '@/config/newsletter-campaign';
import { getCurrentAdmin } from '@/services/admin-authorization.service';
import { NewsletterCampaignService } from '@/services/newsletter-campaign.service';

export const dynamic = 'force-dynamic';

export default async function NewsletterCampaignsPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect('/admin/login');
  const service = new NewsletterCampaignService();
  const [campaigns, recipientEstimate] = await Promise.all([
    service.list(),
    service.currentRecipientEstimate(),
  ]);
  const canEdit =
    admin.role === AdminRole.OWNER || admin.role === AdminRole.MANAGER;
  return (
    <main className="wrap py-16">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="eyebrow">NEWSLETTER</p>
          <h1 className="serif mt-3 text-5xl">ニュースレター</h1>
          <p className="mt-4 text-sm text-stone-600">
            現在の推定対象者数：{recipientEstimate}
            件。実際の対象は配信開始時点で購読中の方です。
          </p>
        </div>
        {canEdit ? (
          <Link
            href="/admin/newsletters/new"
            className="btn bg-[#171412] text-white"
          >
            新規作成
          </Link>
        ) : null}
      </div>
      <div className="mt-10 overflow-x-auto border line bg-white">
        <table className="min-w-[760px] w-full text-left text-sm">
          <thead className="border-b line text-xs text-stone-500">
            <tr>
              <th className="p-4">件名</th>
              <th className="p-4">ステータス</th>
              <th className="p-4">配信予定</th>
              <th className="p-4">対象</th>
              <th className="p-4">送信済み</th>
              <th className="p-4">失敗</th>
              <th className="p-4"></th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((campaign) => (
              <tr key={campaign.id} className="border-b line last:border-0">
                <td className="p-4 font-medium">{campaign.subject}</td>
                <td className="p-4">
                  {NEWSLETTER_CAMPAIGN_STATUS_LABELS[campaign.status]}
                </td>
                <td className="p-4">
                  {campaign.scheduledAt
                    ? new Intl.DateTimeFormat('ja-JP', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                        timeZone: 'Asia/Tokyo',
                      }).format(campaign.scheduledAt)
                    : '—'}
                </td>
                <td className="p-4">{campaign.metrics.target}</td>
                <td className="p-4">{campaign.metrics.sent}</td>
                <td className="p-4">{campaign.metrics.failed}</td>
                <td className="p-4">
                  <Link
                    href={`/admin/newsletters/${campaign.id}`}
                    className="text-xs underline"
                  >
                    詳細
                  </Link>
                </td>
              </tr>
            ))}
            {campaigns.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-stone-500">
                  ニュースレターはまだありません。
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </main>
  );
}
