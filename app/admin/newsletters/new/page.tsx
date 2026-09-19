import { AdminRole } from '@prisma/client';
import { redirect } from 'next/navigation';
import { NewsletterCampaignForm } from '@/components/admin/newsletter-campaign-form';
import { getCurrentAdmin } from '@/services/admin-authorization.service';
import { NewsletterCampaignService } from '@/services/newsletter-campaign.service';

export default async function NewNewsletterCampaignPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect('/admin/login');
  if (admin.role !== AdminRole.OWNER && admin.role !== AdminRole.MANAGER)
    redirect('/admin/newsletters');
  return (
    <main className="wrap py-16">
      <NewsletterCampaignForm
        editable
        recipientEstimate={await new NewsletterCampaignService().currentRecipientEstimate()}
      />
    </main>
  );
}
