import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CONTACT_INQUIRY_STATUS_LABELS } from '@/config/contact-inquiry';
import { getCurrentAdmin } from '@/services/admin-authorization.service';
import { ContactInquiryService } from '@/services/contact-inquiry.service';
import { inquiryListValidator } from '@/validators/contact-inquiry.validator';

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
  const parsed = inquiryListValidator.safeParse(query);
  const result = await service.list(
    parsed.success ? parsed.data : { page: 1 },
    admin.id,
  );
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
        <table className="min-w-[1000px] w-full text-left text-sm">
          <thead className="border-b line text-xs text-stone-500">
            <tr>
              <th className="p-4">ステータス</th>
              <th className="p-4">種別・お問い合わせ番号</th>
              <th className="p-4">お客様</th>
              <th className="p-4">注文番号</th>
              <th className="p-4">最後のメッセージ</th>
              <th className="p-4" />
            </tr>
          </thead>
          <tbody>
            {result.items.map((inquiry) => (
              <tr
                key={inquiry.id}
                data-inquiry-id={inquiry.id}
                className={`border-b line last:border-0 ${inquiry.unread ? 'bg-[var(--soft)]' : ''}`}
              >
                <td className="p-4">
                  {inquiry.unread ? (
                    <span className="mb-2 block font-semibold text-[var(--accent)]">
                      未読
                    </span>
                  ) : null}
                  {CONTACT_INQUIRY_STATUS_LABELS[inquiry.status]}
                </td>
                <td className="p-4">
                  <span className="block font-medium">
                    {inquiry.topic === 'ORDER_SUPPORT'
                      ? '注文サポート'
                      : '一般のお問い合わせ'}
                  </span>
                  <span className="mt-1 block text-xs text-stone-500">
                    {inquiry.publicId}
                  </span>
                </td>
                <td className="p-4">
                  {inquiry.customer?.name ?? inquiry.name ?? '—'}
                  <br />
                  <span className="text-xs text-stone-500">
                    {inquiry.email}
                  </span>
                </td>
                <td className="p-4">{inquiry.orderNumber ?? '—'}</td>
                <td className="p-4">
                  <p className="max-w-xs line-clamp-2">
                    {inquiry.lastMessagePreview}
                  </p>
                  <p className="mt-2 text-xs text-stone-500">
                    {inquiry.lastDirection === 'ADMIN'
                      ? 'LINXAS FUKUOKAからの返信'
                      : 'お客様から'}
                  </p>
                  <time className="mt-1 block text-xs text-stone-500">
                    {new Intl.DateTimeFormat('ja-JP', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                      timeZone: 'Asia/Tokyo',
                    }).format(inquiry.lastMessageAt)}
                  </time>
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
                <td colSpan={6} className="p-8 text-center text-stone-500">
                  お問い合わせはありません。
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <nav
        aria-label="お問い合わせのページ"
        className="mt-6 flex items-center justify-between text-sm"
      >
        {result.pagination.page > 1 ? (
          <Link
            className="underline"
            href={`?${new URLSearchParams({ ...(query.status ? { status: query.status } : {}), ...(query.q ? { q: query.q } : {}), page: String(result.pagination.page - 1) })}`}
          >
            前のページ
          </Link>
        ) : (
          <span />
        )}
        <span>
          {result.pagination.page} / {result.pagination.totalPages}（
          {result.pagination.total}件）
        </span>
        {result.pagination.page < result.pagination.totalPages ? (
          <Link
            className="underline"
            href={`?${new URLSearchParams({ ...(query.status ? { status: query.status } : {}), ...(query.q ? { q: query.q } : {}), page: String(result.pagination.page + 1) })}`}
          >
            次のページ
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </main>
  );
}
