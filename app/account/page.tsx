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
      <nav className="mt-10 grid gap-px bg-stone-200 sm:grid-cols-2 lg:grid-cols-3">
        {[
          ['/account/profile', '会員情報', 'お名前と登録メールアドレス'],
          ['/account/orders', 'ご注文履歴', 'これまでのご注文と配送状況'],
          ['/account/notifications', 'お知らせ', '注文メッセージとサイトからのお知らせ'],
          ['/account/addresses', 'お届け先', '配送先住所の登録と管理'],
          [
            '/account/preferences',
            'メール配信設定',
            'メールマガジンの購読設定',
          ],
          ['/account/security', 'セキュリティ', 'パスワードの変更'],
        ].map(([href, title, description]) => (
          <Link key={href} href={href} className="bg-white p-7 md:p-8">
            <span className="serif text-2xl">{title}</span>
            <span className="mt-3 block text-xs leading-6 text-stone-500">
              {description}
            </span>
          </Link>
        ))}
      </nav>
    </main>
  );
}
