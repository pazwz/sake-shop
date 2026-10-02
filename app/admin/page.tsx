import Link from 'next/link';
import { ContactInquiryService } from '@/services/contact-inquiry.service';
import { getCurrentAdmin } from '@/services/admin-authorization.service';
import { redirect } from 'next/navigation';
import { SyncService } from '@/services/sync.service';
import { ProductService } from '@/services/product.service';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect('/admin/login');
  const service = new ContactInquiryService();
  const [newInquiryCount, unread, sync, publicProductCount] = await Promise.all(
    [
      service.countNew(),
      service.unreadSummary(admin.id),
      new SyncService().getProductionSmaregiSyncStatus(),
      new ProductService().countPublic(),
    ],
  );
  return (
    <main className="wrap py-20">
      <p className="eyebrow">LINXAS ADMIN</p>
      <h1 className="serif mt-4 text-5xl">ダッシュボード</h1>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Link
          href="/admin/inquiries?status=NEW"
          className="border line bg-white p-5"
        >
          未対応お問い合わせ{' '}
          <span className="ml-3 font-semibold">{newInquiryCount}</span>
        </Link>
        <Link href="/admin/inquiries" className="border line bg-white p-5">
          未読のお問い合わせ{' '}
          <span className="ml-3 font-semibold">
            {unread.unreadInquiryCount}
          </span>
        </Link>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Link href="/admin/products" className="border line bg-white p-5">
          公開商品{' '}
          <span className="ml-3 font-semibold">{publicProductCount}</span>
        </Link>
        <Link href="/admin/operations" className="border line bg-white p-5">
          スマレジ最終同期{' '}
          <span className="mt-2 block text-sm text-stone-600">
            {sync.completedAt
              ? new Date(sync.completedAt).toLocaleString('ja-JP', {
                  timeZone: 'Asia/Tokyo',
                })
              : '実行履歴はありません'}
          </span>
        </Link>
      </div>
      <p className="mt-5 max-w-xl text-sm leading-7 text-stone-600">
        ホームページの Hero
        と特集を管理します。商品、価格、在庫には変更を加えません。
      </p>
      <Link
        href="/admin/collections"
        className="btn mt-8 bg-[#171412] text-white"
      >
        ホームページを管理
      </Link>
      <Link
        href="/admin/collections/all"
        className="btn ml-3 mt-8 border border-[#171412]"
      >
        特集・ストーリーを管理
      </Link>
      <Link
        href="/admin/products"
        className="btn ml-3 mt-8 border border-[#171412]"
      >
        商品を管理
      </Link>
      <Link
        href="/admin/orders"
        className="btn ml-3 mt-8 border border-[#171412]"
      >
        注文を管理
      </Link>
      {admin ? (
        <Link
          href="/admin/integrations/smaregi"
          className="btn ml-3 mt-8 border border-[#171412]"
        >
          Smaregi 連携
        </Link>
      ) : null}
      <Link
        href="/admin/operations"
        className="btn ml-3 mt-8 border border-[#171412]"
      >
        運用状態
      </Link>
      <Link
        href="/admin/newsletters"
        className="btn ml-3 mt-8 border border-[#171412]"
      >
        ニュースレター
      </Link>
      <Link
        href="/admin/inquiries"
        className="btn ml-3 mt-8 border border-[#171412]"
      >
        お問い合わせ{newInquiryCount ? ` ${newInquiryCount}` : ''}
      </Link>
      <Link
        href="/admin/announcements"
        className="btn ml-3 mt-8 border border-[#171412]"
      >
        お知らせを管理
      </Link>
    </main>
  );
}
