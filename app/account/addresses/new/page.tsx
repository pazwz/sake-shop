import { redirect } from 'next/navigation';
import { CustomerAccountHeader } from '@/components/customer-account-header';
import { CustomerAddressForm } from '@/components/customer-account-forms';
import { getCurrentCustomer } from '@/services/customer-authorization.service';

export default async function NewCustomerAddressPage() {
  const customer = await getCurrentCustomer();
  if (!customer) redirect('/login?redirect=/account/addresses/new');
  return (
    <main className="wrap py-14 md:py-20">
      <CustomerAccountHeader eyebrow="New address" title="お届け先を追加" />
      <CustomerAddressForm />
    </main>
  );
}
