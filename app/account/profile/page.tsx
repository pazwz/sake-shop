import { redirect } from 'next/navigation';
import { CustomerAccountHeader } from '@/components/customer-account-header';
import { CustomerProfileForm } from '@/components/customer-account-forms';
import { getCurrentCustomer } from '@/services/customer-authorization.service';

export default async function CustomerProfilePage() {
  const customer = await getCurrentCustomer();
  if (!customer) redirect('/login?redirect=/account/profile');
  return (
    <main className="wrap py-14 md:py-20">
      <CustomerAccountHeader eyebrow="Member profile" title="会員情報" />
      <CustomerProfileForm name={customer.name} email={customer.email} />
    </main>
  );
}
