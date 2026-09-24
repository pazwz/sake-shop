import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CONTACT_INQUIRY_STATUS_LABELS } from '@/config/contact-inquiry';
import { getCurrentAdmin } from '@/services/admin-authorization.service';
import { ContactInquiryService } from '@/services/contact-inquiry.service';

export const dynamic = 'force-dynamic';
export default async function InquiriesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string; q?: string }>;
}) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect('/admin/login');
  const query = await searchParams;
  const service = new ContactInquiryService();
  const result = await service.list({
    page: Number(query.page ?? 1) || 1,
    ...(query.status ? { status: query.status as never } : {}),
    ...(query.q ? { q: query.q } : {}),
  });
  return (
    <main className="wrap py-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">CUSTOMER SUPPORT</p>
          <h1 className="serif mt-3 text-5xl">お問い合わせ管理</h1>
        </div>
        <Link href="/admin" className="text-sm underline">
          管理画面へ戻る
        </Link>
      </div>
      <form className="mt-8 flex flex-wrap gap-3">
        <input
          name="q"
          defaultValue={query.q}
          className="border line bg-white px-3 py-2 text-sm"
          placeholder="番号・メール・注文番号"
        />
        <select
          name="status"
          defaultValue={query.status ?? ''}
          className="border line bg-white px-3 py-2 text-sm"
        >
          <option value="">すべてのステータス</option>
          {Object.entries(CONTACT_INQUIRY_STATUS_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <button className="btn border border-[#171412]">絞り込む</button>
      </form>
      <div className="mt-8 overflow-x-auto border line bg-white">
        <table className="min-w-[840px] w-full text-left text-sm">
          <thead className="border-b line text-xs text-stone-500">
            <tr>
              <th className="p-4">ステータス</th>
              <th className="p-4">お問い合わせ番号</th>
              <th className="p-4">お客様</th>
              <th className="p-4">注文番号</th>
              <th className="p-4">担当者</th>
              <th className="p-4">最終メッセージ</th>
              <th className="p-4" />
            </tr>
          </thead>
          <tbody>
            {result.items.map((inquiry) => (
              <tr key={inquiry.id} className="border-b line last:border-0">
                <td className="p-4">
                  {CONTACT_INQUIRY_STATUS_LABELS[inquiry.status]}
                </td>
                <td className="p-4 font-medium">{inquiry.publicId}</td>
                <td className="p-4">
                  {inquiry.customer?.name ?? inquiry.name ?? '—'}
                  <br />
                  <span className="text-xs text-stone-500">
                    {inquiry.email}
                  </span>
                </td>
                <td className="p-4">{inquiry.orderNumber ?? '—'}</td>
                <td className="p-4">
                  {inquiry.assignedAdmin?.name ?? '未設定'}
                </td>
                <td className="p-4">
                  {new Intl.DateTimeFormat('ja-JP', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                    timeZone: 'Asia/Tokyo',
                  }).format(inquiry.lastMessageAt)}
                </td>
                <td className="p-4">
                  <Link
                    href={`/admin/inquiries/${inquiry.id}`}
                    className="text-xs underline"
                  >
                    詳細
                  </Link>
                </td>
              </tr>
            ))}
            {result.items.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-stone-500">
                  お問い合わせはありません。
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </main>
  );
}
