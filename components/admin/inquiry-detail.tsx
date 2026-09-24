'use client';

import { AdminRole, ContactInquiryStatus } from '@prisma/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { CONTACT_INQUIRY_STATUS_LABELS } from '@/config/contact-inquiry';

type Inquiry = {
  id: string;
  publicId: string;
  status: ContactInquiryStatus;
  topic: string;
  name: string | null;
  email: string;
  message: string;
  orderNumber: string | null;
  customer: { id: string; name: string } | null;
  order: { id: string; orderNumber: string } | null;
  assignedAdminId: string | null;
  assignedAdmin: { id: string; name: string } | null;
  createdAt: Date;
  messages: Array<{
    id: string;
    direction: string;
    body: string;
    createdAt: Date;
    authorAdmin: { name: string } | null;
  }>;
  notes: Array<{
    id: string;
    body: string;
    createdAt: Date;
    admin: { name: string };
  }>;
};
type Admin = { id: string; name: string; role: AdminRole };

const call = async (
  url: string,
  method: string,
  body: Record<string, unknown>,
) => {
  const response = await fetch(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error('更新に失敗しました。');
};
export function InquiryDetail({
  inquiry,
  admins,
  currentAdmin,
}: {
  inquiry: Inquiry;
  admins: Admin[];
  currentAdmin: Admin;
}) {
  const router = useRouter();
  const [reply, setReply] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = async (operation: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await operation();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : '更新に失敗しました。');
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Link href="/admin/inquiries" className="text-sm underline">
        ← お問い合わせ管理
      </Link>
      <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{inquiry.publicId}</p>
          <h1 className="serif mt-3 text-4xl">注文メッセージ詳細</h1>
        </div>
        <span className="text-sm">
          {CONTACT_INQUIRY_STATUS_LABELS[inquiry.status]}
        </span>
      </div>
      {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
      <section className="mt-8 grid gap-6 border line bg-white p-6 md:grid-cols-2">
        <div>
          <h2 className="font-medium">基本情報</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div>
              種別：
              {inquiry.order ? '注文サポート' : 'Legacy / General inquiry'}
            </div>
            <div>
              受付日時：
              {new Intl.DateTimeFormat('ja-JP', {
                dateStyle: 'medium',
                timeStyle: 'short',
                timeZone: 'Asia/Tokyo',
              }).format(inquiry.createdAt)}
            </div>
            <div>お名前：{inquiry.customer?.name ?? inquiry.name ?? '—'}</div>
            <div>メールアドレス：{inquiry.email}</div>
            {inquiry.order ? (
              <div>
                注文：
                <Link
                  className="underline"
                  href={`/admin/orders/${inquiry.order.id}`}
                >
                  {inquiry.order.orderNumber}
                </Link>
              </div>
            ) : (
              <div>注文番号：{inquiry.orderNumber ?? '—'}</div>
            )}
          </dl>
        </div>
        <div>
          <h2 className="font-medium">担当者・ステータス</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <select
              value={inquiry.assignedAdminId ?? ''}
              disabled={busy}
              onChange={(event) =>
                run(() =>
                  call(
                    `/api/v1/admin/inquiries/${inquiry.id}/assign`,
                    'PATCH',
                    { assignedAdminId: event.target.value || null },
                  ),
                )
              }
              className="border line p-2 text-sm"
            >
              <option value="">未設定</option>
              {admins.map((admin) => (
                <option
                  key={admin.id}
                  value={admin.id}
                  disabled={
                    currentAdmin.role === AdminRole.STAFF &&
                    admin.id !== currentAdmin.id
                  }
                >
                  {admin.name}
                </option>
              ))}
            </select>
            <select
              value={inquiry.status}
              disabled={busy}
              onChange={(event) =>
                run(() =>
                  call(
                    `/api/v1/admin/inquiries/${inquiry.id}/status`,
                    'PATCH',
                    { status: event.target.value },
                  ),
                )
              }
              className="border line p-2 text-sm"
            >
              {Object.entries(CONTACT_INQUIRY_STATUS_LABELS).map(
                ([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ),
              )}
            </select>
          </div>
        </div>
      </section>
      <section className="mt-6 border line bg-white p-6">
        <h2 className="font-medium">サイト内メッセージ</h2>
        <div className="mt-4 space-y-4">
          {inquiry.messages.map((message) => (
            <article
              key={message.id}
              className="border-l-2 border-[#6f1831] pl-4 text-sm"
            >
              <p className="font-medium">
                {message.direction === 'ADMIN' ? 'LINXASからの返信' : 'お客様'}{' '}
                {message.authorAdmin ? `・ ${message.authorAdmin.name}` : ''}
              </p>
              <p className="mt-2 whitespace-pre-wrap">{message.body}</p>
            </article>
          ))}
        </div>
        {inquiry.messages.length === 0 ? (
          <p className="mt-4 whitespace-pre-wrap text-sm leading-7">
            {inquiry.message}
          </p>
        ) : null}
        <p className="mt-6 text-xs text-stone-500">
          メール返信は受け付けず、すべてサイト内で対応します。
        </p>
      </section>
      <section className="mt-6 border line bg-white p-6">
        <h2 className="font-medium">返信</h2>
        <textarea
          value={reply}
          onChange={(event) => setReply(event.target.value)}
          maxLength={5000}
          className="mt-4 min-h-36 w-full border line p-3 text-sm"
          placeholder="返信内容を入力してください。"
        />
        <button
          disabled={busy || !reply.trim()}
          onClick={() =>
            run(async () => {
              await call(
                `/api/v1/admin/inquiries/${inquiry.id}/reply`,
                'POST',
                { body: reply, idempotencyKey: crypto.randomUUID() },
              );
              setReply('');
            })
          }
          className="btn mt-3 bg-[#171412] text-white"
        >
          返信する
        </button>
      </section>
      <section className="mt-6 border line bg-white p-6">
        <h2 className="font-medium">内部メモ</h2>
        {inquiry.notes.map((item) => (
          <article key={item.id} className="mt-3 text-sm">
            <strong>{item.admin.name}</strong>
            <p className="mt-1 whitespace-pre-wrap">{item.body}</p>
          </article>
        ))}
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={5000}
          className="mt-4 min-h-24 w-full border line p-3 text-sm"
          placeholder="内部メモ（お客様には送信されません）"
        />
        <button
          disabled={busy || !note.trim()}
          onClick={() =>
            run(async () => {
              await call(
                `/api/v1/admin/inquiries/${inquiry.id}/notes`,
                'POST',
                { body: note },
              );
              setNote('');
            })
          }
          className="btn mt-3 border border-[#171412]"
        >
          内部メモを追加
        </button>
      </section>
    </>
  );
}
