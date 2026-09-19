import { AdminRole } from '@prisma/client';
import { notFound, redirect } from 'next/navigation';
import { NewsletterCampaignForm } from '@/components/admin/newsletter-campaign-form';
import { NEWSLETTER_CAMPAIGN_AUDIT_LABELS } from '@/config/newsletter-campaign';
import { NotFoundError } from '@/lib/errors';
import { getCurrentAdmin } from '@/services/admin-authorization.service';
import { NewsletterCampaignService } from '@/services/newsletter-campaign.service';

export const dynamic = 'force-dynamic';

export default async function NewsletterCampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect('/admin/login');
  const service = new NewsletterCampaignService();
  let campaign;
  let recipientEstimate;
  try {
    [campaign, recipientEstimate] = await Promise.all([
      service.get((await params).id),
      service.currentRecipientEstimate(),
    ]);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
  const editable =
    (admin.role === AdminRole.OWNER || admin.role === AdminRole.MANAGER) &&
    ['DRAFT', 'SCHEDULED'].includes(campaign.status);
  return (
    <main className="wrap py-16">
      <NewsletterCampaignForm
        campaign={campaign}
        editable={editable}
        recipientEstimate={recipientEstimate}
      />
      <section className="mx-auto mt-8 max-w-5xl border line bg-white p-6">
        <h2 className="serif text-2xl">操作履歴</h2>
        {campaign.audits.length ? (
          <ul className="mt-5 divide-y line text-sm">
            {campaign.audits.map((audit) => (
              <li
                key={`${audit.action}:${audit.createdAt.toISOString()}`}
                className="flex flex-wrap justify-between gap-2 py-3"
              >
                <span>
                  {NEWSLETTER_CAMPAIGN_AUDIT_LABELS[audit.action] ??
                    audit.action}{' '}
                  ・ {audit.actorName}
                </span>
                <time className="text-stone-500">
                  {new Intl.DateTimeFormat('ja-JP', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                    timeZone: 'Asia/Tokyo',
                  }).format(audit.createdAt)}
                </time>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-stone-500">
            操作履歴はまだありません。
          </p>
        )}
      </section>
    </main>
  );
}
