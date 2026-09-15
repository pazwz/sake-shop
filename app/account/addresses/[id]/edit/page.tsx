import { notFound, redirect } from 'next/navigation';
import { CustomerAccountHeader } from '@/components/customer-account-header';
import { CustomerAddressForm } from '@/components/customer-account-forms';
import { NotFoundError } from '@/lib/errors';
import { CustomerAddressService } from '@/services/customer-address.service';
import { getCurrentCustomer } from '@/services/customer-authorization.service';

export default async function EditCustomerAddressPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const customer = await getCurrentCustomer();
  const { id } = await params;
  if (!customer)
    redirect(
      `/login?redirect=/account/addresses/${encodeURIComponent(id)}/edit`,
    );
  let address;
  try {
    address = await new CustomerAddressService().getOwnedAddress(
      customer.id,
      id,
    );
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
  return (
    <main className="wrap py-14 md:py-20">
      <CustomerAccountHeader eyebrow="Edit address" title="お届け先を編集" />
      <CustomerAddressForm
        initial={{
          id: address.id,
          recipientName: address.recipientName,
          postalCode: address.postalCode,
          prefecture: address.prefecture,
          city: address.city,
          addressLine1: address.addressLine1,
          addressLine2: address.addressLine2,
          phone: address.phone,
          isDefault: address.isDefault,
        }}
      />
    </main>
  );
}
