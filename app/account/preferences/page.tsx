import { redirect } from 'next/navigation';
import { CustomerAccountHeader } from '@/components/customer-account-header';
import { CustomerNewsletterPreference } from '@/components/customer-account-forms';
import { getCurrentCustomer } from '@/services/customer-authorization.service';
import { NewsletterService } from '@/services/newsletter.service';

export default async function CustomerPreferencesPage() {
  const customer = await getCurrentCustomer();
  if (!customer) redirect('/login?redirect=/account/preferences');
  const preference = await new NewsletterService().getCustomerPreference(
    customer.email,
  );
  return (
    <main className="wrap py-14 md:py-20">
      <CustomerAccountHeader
        eyebrow="Email preferences"
        title="メール配信設定"
      />
      <CustomerNewsletterPreference initialSubscribed={preference.subscribed} />
    </main>
  );
}
