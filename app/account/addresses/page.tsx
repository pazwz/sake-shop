import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CustomerAccountHeader } from '@/components/customer-account-header';
import { CustomerAddressDeleteButton } from '@/components/customer-account-forms';
import { CustomerAddressService } from '@/services/customer-address.service';
import { getCurrentCustomer } from '@/services/customer-authorization.service';

export default async function CustomerAddressesPage() {
  const customer = await getCurrentCustomer();
  if (!customer) redirect('/login?redirect=/account/addresses');
  const addresses = await new CustomerAddressService().list(customer.id);
  return (
    <main className="wrap py-14 md:py-20">
      <CustomerAccountHeader eyebrow="Address book" title="お届け先" />
      <div className="mt-8">
        <Link href="/account/addresses/new" className="btn">
          新しいお届け先を追加
        </Link>
      </div>
      {addresses.length === 0 ? (
        <p className="mt-10 border-y line py-10 text-sm text-stone-600">
          登録されているお届け先はありません。
        </p>
      ) : (
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {addresses.map((address) => (
            <article key={address.id} className="border p-6 text-sm leading-7">
              <div className="flex items-start justify-between gap-4">
                <h2 className="serif text-xl">{address.recipientName}</h2>
                {address.isDefault ? (
                  <span className="text-xs text-[#6f1831]">デフォルト</span>
                ) : null}
              </div>
              <p className="mt-4">
                〒{address.postalCode.slice(0, 3)}-{address.postalCode.slice(3)}
                <br />
                {address.prefecture}
                {address.city}
                {address.addressLine1}
                {address.addressLine2 ? (
                  <>
                    <br />
                    {address.addressLine2}
                  </>
                ) : null}
                <br />
                {address.phone}
              </p>
              <div className="mt-5 flex gap-5">
                <Link
                  href={`/account/addresses/${address.id}/edit`}
                  className="text-xs underline"
                >
                  編集
                </Link>
                <CustomerAddressDeleteButton id={address.id} />
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
