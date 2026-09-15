import { redirect } from 'next/navigation';
import { CustomerAccountHeader } from '@/components/customer-account-header';
import { CustomerPasswordForm } from '@/components/customer-account-forms';
import { getCurrentCustomer } from '@/services/customer-authorization.service';

export default async function CustomerSecurityPage() {
  const customer = await getCurrentCustomer();
  if (!customer) redirect('/login?redirect=/account/security');
  return (
    <main className="wrap py-14 md:py-20">
      <CustomerAccountHeader eyebrow="Account security" title="セキュリティ" />
      <CustomerPasswordForm />
    </main>
  );
}
