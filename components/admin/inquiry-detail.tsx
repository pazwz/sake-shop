'use client';

import { ContactInquiryStatus } from '@prisma/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { CONTACT_INQUIRY_STATUS_LABELS } from '@/config/contact-inquiry';
import { ADMIN_INQUIRY_READ_EVENT } from '@/lib/admin-inquiry-polling';
import { getAdminDisplayName } from '@/lib/admin-display-name';

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
  updatedAt: Date;
  messages: Array<{
    id: string;
    direction: string;
    body: string;
    createdAt: Date;
    authorAdmin: { name: string; isActive: boolean } | null;
  }>;
  notes: Array<{
    id: string;
    body: string;
    createdAt: Date;
    admin: { name: string; isActive: boolean };
  }>;
};

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
  return response;
};
export function InquiryDetail({ inquiry }: { inquiry: Inquiry }) {
  const router = useRouter();
  const [reply, setReply] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const locked = useRef(false);
  const [status, setStatus] = useState(inquiry.status);
  const savedStatus = useRef({
    status: inquiry.status,
    updatedAt: new Date(inquiry.updatedAt).getTime(),
  });
  const [statusFeedback, setStatusFeedback] = useState<
    'idle' | 'pending' | 'success' | 'error'
  >('idle');
  const [replyFeedback, setReplyFeedback] = useState<
    'idle' | 'pending' | 'success' | 'error'
  >('idle');
  const replyKey = useRef<string | null>(null);

  useEffect(() => {
    const updatedAt = new Date(inquiry.updatedAt).getTime();
    if (updatedAt <= savedStatus.current.updatedAt) return;
    savedStatus.current = { status: inquiry.status, updatedAt };
    if (!locked.current) setStatus(inquiry.status);
  }, [inquiry.status, inquiry.updatedAt]);

  useEffect(() => {
    if (statusFeedback !== 'success') return;
    const timer = window.setTimeout(() => setStatusFeedback('idle'), 1800);
    return () => window.clearTimeout(timer);
  }, [statusFeedback]);
  useEffect(() => {
    let active = true;
    let started = false;
    const displayed = inquiry.messages
      .filter((message) => message.direction === 'CUSTOMER')
      .map((message) => message.id);
    const markDisplayed = async () => {
      if (document.hidden || started || displayed.length === 0) return;
      started = true;
      try {
        for (let offset = 0; offset < displayed.length; offset += 500) {
          if (!active) return;
          await call(`/api/v1/admin/inquiries/${inquiry.id}/read`, 'POST', {
            messageIds: displayed.slice(offset, offset + 500),
          });
        }
        if (active) window.dispatchEvent(new Event(ADMIN_INQUIRY_READ_EVENT));
      } catch {
        if (active)
          setError(
            '既読情報を保存できませんでした。ページを再読み込みしてください。',
          );
      }
    };
    const onVisibility = () => void markDisplayed();
    void markDisplayed();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      active = false;
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [inquiry.id, inquiry.messages]);
  const run = async (operation: () => Promise<void>) => {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError('');
    try {
      await operation();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : '更新に失敗しました。');
    } finally {
      locked.current = false;
      setBusy(false);
    }
  };
  const saveStatus = async (next: ContactInquiryStatus) => {
    if (locked.current || next === status) return;
    locked.current = true;
    setBusy(true);
    setStatus(next);
    setStatusFeedback('pending');
    try {
      const response = await call(`/api/v1/admin/inquiries/${inquiry.id}/status`, 'PATCH', {
        status: next,
      });
      const { data } = (await response.json()) as {
        data: { status: ContactInquiryStatus; updatedAt: string };
      };
      const updatedAt = new Date(data.updatedAt).getTime();
      if (updatedAt >= savedStatus.current.updatedAt)
        savedStatus.current = { status: data.status, updatedAt };
      setStatus(savedStatus.current.status);
      setStatusFeedback('success');
      router.refresh();
    } catch {
      setStatus(savedStatus.current.status);
      setStatusFeedback('error');
    } finally {
      locked.current = false;
      setBusy(false);
    }
  };
  const sendReply = async () => {
    if (locked.current || !reply.trim()) return;
    locked.current = true;
    setBusy(true);
    setReplyFeedback('pending');
    // Keep the same key after an uncertain failure; retry cannot create a duplicate.
    const idempotencyKey = replyKey.current ?? crypto.randomUUID();
    replyKey.current = idempotencyKey;
    try {
      await call(`/api/v1/admin/inquiries/${inquiry.id}/reply`, 'POST', {
        body: reply,
        idempotencyKey,
      });
      setReply('');
      replyKey.current = null;
      setReplyFeedback('success');
      router.refresh();
    } catch {
      setReplyFeedback('error');
    } finally {
      locked.current = false;
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
        <span className="text-sm">{CONTACT_INQUIRY_STATUS_LABELS[status]}</span>
      </div>
      {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
      <section className="mt-8 grid gap-6 border line bg-white p-6 lg:grid-cols-[1.5fr_1fr]">
        <div>
          <h2 className="font-medium">問い合わせ情報</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div>
              種別：
              {inquiry.order
                ? '注文サポート'
                : '一般のお問い合わせ（過去の受付）'}
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
          <h2 className="font-medium">ステータス</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <select
              aria-label="ステータス"
              value={status}
              disabled={busy}
              onChange={(event) =>
                void saveStatus(event.target.value as ContactInquiryStatus)
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
            <span role="status" className="flex items-center gap-2 text-sm">
              {statusFeedback === 'pending' ? (
                <>
                  <PendingSpinner />
                  保存中…
                </>
              ) : null}
              {statusFeedback === 'success' ? '保存済み' : null}
              {statusFeedback === 'error' ? (
                <span className="text-red-700">保存に失敗しました</span>
              ) : null}
            </span>
          </div>
        </div>
      </section>
      <section
        className="mt-6 border line bg-white p-4 sm:p-6"
        aria-label="管理者メッセージ履歴"
      >
        <h2 className="font-medium">サイト内メッセージ</h2>
        <div className="mt-6 space-y-6">
          {inquiry.messages.map((message) => (
            <article
              key={message.id}
              data-message-direction={message.direction}
              className={`w-[92%] max-w-3xl p-4 text-sm sm:w-[85%] ${message.direction === 'ADMIN' ? 'ml-auto border line bg-[var(--soft)]' : 'mr-auto border-l-2 border-[var(--accent)] bg-white'}`}
            >
              <p className="font-medium">
                {message.direction === 'ADMIN' ? 'LINXASからの返信' : 'お客様'}{' '}
                {message.authorAdmin
                  ? `・ ${getAdminDisplayName(message.authorAdmin)}`
                  : ''}
              </p>
              <p className="mt-3 whitespace-pre-wrap break-words leading-7">
                {message.body}
              </p>
              <time
                className="mt-3 block text-xs text-stone-500"
                dateTime={new Date(message.createdAt).toISOString()}
              >
                {new Date(message.createdAt).toLocaleString('ja-JP', {
                  timeZone: 'Asia/Tokyo',
                })}
              </time>
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
          aria-label="お客様への返信"
          value={reply}
          disabled={busy}
          onChange={(event) => {
            setReply(event.target.value);
            replyKey.current = null;
            setReplyFeedback('idle');
          }}
          maxLength={5000}
          className="mt-4 min-h-36 w-full border line p-3 text-sm"
          placeholder="返信内容を入力してください。"
        />
        <button
          disabled={busy || !reply.trim()}
          onClick={() => void sendReply()}
          className="btn mt-3 bg-[#171412] text-white"
        >
          {replyFeedback === 'pending' ? (
            <>
              <PendingSpinner />
              送信中…
            </>
          ) : (
            '返信する'
          )}
        </button>
        <p role="status" className="mt-3 text-sm">
          {replyFeedback === 'success' ? '送信済み' : null}
          {replyFeedback === 'error' ? (
            <span className="text-red-700">送信に失敗しました</span>
          ) : null}
        </p>
      </section>
      <section className="mt-6 border line bg-white p-6">
        <h2 className="font-medium">内部メモ</h2>
        {inquiry.notes.map((item) => (
          <article key={item.id} className="mt-3 text-sm">
            <strong>{getAdminDisplayName(item.admin)}</strong>
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

function PendingSpinner() {
  return (
    <span
      aria-hidden="true"
      className="inline-block size-3 shrink-0 animate-spin rounded-full border border-current border-r-transparent motion-reduce:animate-none"
    />
  );
}
