import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CustomerLogoutButton } from '@/components/customer-logout-button';
import { getCurrentCustomer } from '@/services/customer-authorization.service';

export default async function AccountPage() {
  const customer = await getCurrentCustomer();
  if (!customer) redirect('/login?redirect=/account');
  return (
    <main className="wrap py-14 md:py-20">
      <p className="eyebrow">My account</p>
      <div className="mt-4 flex items-end justify-between gap-5">
        <h1 className="serif text-5xl">アカウント</h1>
        <CustomerLogoutButton />
      </div>
      <dl className="mt-10 max-w-xl border-y line py-7 text-sm">
        <div className="grid grid-cols-[7rem_1fr] gap-4">
          <dt>お名前</dt>
          <dd>{customer.name}</dd>
        </div>
        <div className="mt-4 grid grid-cols-[7rem_1fr] gap-4">
          <dt>メール</dt>
          <dd>{customer.email}</dd>
        </div>
      </dl>
      <Link href="/account/orders" className="btn mt-8">
        注文履歴を見る
      </Link>
    </main>
  );
}
