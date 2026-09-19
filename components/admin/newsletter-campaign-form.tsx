'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CollectionImageUpload } from '@/components/admin/collection-image-upload';
import type { NewsletterCampaignAdminDto } from '@/types/newsletter-campaign';

type Feedback = { kind: 'success' | 'error'; text: string } | null;

const toJstInputValue = (iso: string | null) => {
  if (!iso) return '';
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(iso));
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}T${value('hour')}:${value('minute')}`;
};

const fromJstInputValue = (value: string) => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  return new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour) - 9,
      Number(minute),
    ),
  ).toISOString();
};

const responseError = async (response: Response, fallback: string) => {
  try {
    const body = (await response.json()) as { error?: { detail?: string } };
    return body.error?.detail ?? fallback;
  } catch {
    return fallback;
  }
};

export function NewsletterCampaignForm({
  campaign,
  editable,
  recipientEstimate,
}: {
  campaign?: NewsletterCampaignAdminDto;
  editable: boolean;
  recipientEstimate: number;
}) {
  const router = useRouter();
  const [heroImageUrl, setHeroImageUrl] = useState(
    campaign?.heroImageUrl ?? '',
  );
  const [uploading, setUploading] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const read = (form: HTMLFormElement) => {
    const data = new FormData(form);
    return {
      subject: String(data.get('subject') ?? ''),
      preheader: String(data.get('preheader') ?? '') || null,
      headline: String(data.get('headline') ?? ''),
      heroImageUrl: heroImageUrl || null,
      heroImageAlt: String(data.get('heroImageAlt') ?? '') || null,
      body: String(data.get('body') ?? ''),
      ctaLabel: String(data.get('ctaLabel') ?? '') || null,
      ctaUrl: String(data.get('ctaUrl') ?? '') || null,
    };
  };

  const save = async (form: HTMLFormElement) => {
    if (uploading || busy) return;
    setBusy(true);
    setFeedback(null);
    const response = await fetch(
      campaign
        ? `/api/v1/admin/newsletters/${campaign.id}`
        : '/api/v1/admin/newsletters',
      {
        method: campaign ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(read(form)),
      },
    );
    if (!response.ok) {
      setFeedback({
        kind: 'error',
        text: await responseError(response, '保存に失敗しました。'),
      });
      setBusy(false);
      return;
    }
    const result = (await response.json()) as { data?: { id?: string } };
    setFeedback({ kind: 'success', text: '保存しました。' });
    setBusy(false);
    if (!campaign && result.data?.id)
      router.push(`/admin/newsletters/${result.data.id}`);
    else router.refresh();
  };

  const openPreview = async (form: HTMLFormElement) => {
    setBusy(true);
    setFeedback(null);
    const response = await fetch(
      `/api/v1/admin/newsletters/${campaign?.id ?? 'draft'}/preview`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(read(form)),
      },
    );
    if (!response.ok) {
      setFeedback({
        kind: 'error',
        text: await responseError(
          response,
          'プレビューを生成できませんでした。',
        ),
      });
    } else {
      const result = (await response.json()) as { data?: { html?: string } };
      setPreview(result.data?.html ?? null);
    }
    setBusy(false);
  };

  const action = async (
    path: 'test' | 'send-now' | 'schedule' | 'cancel',
    form: HTMLFormElement,
  ) => {
    if (!campaign || busy) return;
    const labels = {
      test: 'この内容を自分宛てにテスト送信します。よろしいですか？',
      'send-now': `件名「${campaign.subject}」を現在の推定${recipientEstimate}件へ配信予約します。通常2分以内に開始します。`,
      schedule: `件名「${campaign.subject}」を予約配信します。実際の対象は配信開始時点で購読中の方です。`,
      cancel: 'この配信予約をキャンセルします。よろしいですか？',
    };
    if (!window.confirm(labels[path])) return;
    const body =
      path === 'schedule'
        ? (() => {
            const scheduledAt = fromJstInputValue(
              String(new FormData(form).get('scheduledAt') ?? ''),
            );
            return scheduledAt ? { scheduledAt } : null;
          })()
        : undefined;
    if (path === 'schedule' && !body) {
      setFeedback({ kind: 'error', text: '配信日時をJSTで入力してください。' });
      return;
    }
    setBusy(true);
    setFeedback(null);
    const response = await fetch(
      `/api/v1/admin/newsletters/${campaign.id}/${path}`,
      {
        method: 'POST',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      },
    );
    if (!response.ok)
      setFeedback({
        kind: 'error',
        text: await responseError(response, '操作に失敗しました。'),
      });
    else {
      setFeedback({
        kind: 'success',
        text:
          path === 'test'
            ? 'テストメールをキューに追加しました。'
            : '操作を受け付けました。',
      });
      router.refresh();
    }
    setBusy(false);
  };

  const canSchedule =
    campaign?.status === 'DRAFT' || campaign?.status === 'SCHEDULED';
  const canCancel = canSchedule;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <Link href="/admin/newsletters" className="text-xs text-stone-500">
            ← ニュースレター
          </Link>
          <p className="eyebrow mt-4">NEWSLETTER CAMPAIGN</p>
          <h1 className="serif mt-3 text-4xl">
            {campaign ? 'ニュースレターを編集' : 'ニュースレターを作成'}
          </h1>
          <p className="mt-3 text-sm leading-7 text-stone-600">
            実際の配信対象は配信開始時点で購読中の方です。現在の推定対象者数：
            {recipientEstimate}件
          </p>
        </div>
        {campaign ? (
          <span className="border line bg-white px-3 py-2 text-xs">
            {campaign.status}
          </span>
        ) : null}
      </div>
      <form
        className="mt-10 space-y-7 border line bg-white p-6 md:p-8"
        onSubmit={(event) => {
          event.preventDefault();
          void save(event.currentTarget);
        }}
      >
        <label className="block text-sm font-semibold">
          件名
          <input
            name="subject"
            required
            maxLength={120}
            disabled={!editable || busy}
            defaultValue={campaign?.subject}
            className="mt-2 w-full border line px-3 py-3 font-normal"
          />
        </label>
        <label className="block text-sm font-semibold">
          プリヘッダー
          <input
            name="preheader"
            maxLength={200}
            disabled={!editable || busy}
            defaultValue={campaign?.preheader ?? ''}
            className="mt-2 w-full border line px-3 py-3 font-normal"
          />
        </label>
        <label className="block text-sm font-semibold">
          見出し
          <input
            name="headline"
            required
            maxLength={120}
            disabled={!editable || busy}
            defaultValue={campaign?.headline}
            className="mt-2 w-full border line px-3 py-3 font-normal"
          />
        </label>
        {editable ? (
          <CollectionImageUpload
            name="heroImageUrl"
            label="メイン画像"
            description="任意。既存の画像アップロードを使用します。"
            initialUrl={campaign?.heroImageUrl}
            onUploadingChange={setUploading}
            onUrlChange={setHeroImageUrl}
          />
        ) : campaign?.heroImageUrl ? (
          <Image
            src={campaign.heroImageUrl}
            alt={campaign.heroImageAlt ?? ''}
            width={1200}
            height={600}
            className="max-h-64 w-full object-contain"
          />
        ) : null}
        <label className="block text-sm font-semibold">
          画像代替テキスト
          <input
            name="heroImageAlt"
            maxLength={200}
            disabled={!editable || busy}
            defaultValue={campaign?.heroImageAlt ?? ''}
            className="mt-2 w-full border line px-3 py-3 font-normal"
          />
        </label>
        <label className="block text-sm font-semibold">
          本文
          <textarea
            name="body"
            required
            maxLength={10000}
            disabled={!editable || busy}
            defaultValue={campaign?.body}
            rows={12}
            className="mt-2 w-full border line px-3 py-3 font-normal leading-7"
          />
        </label>
        <div className="grid gap-5 md:grid-cols-2">
          <label className="block text-sm font-semibold">
            ボタン文言
            <input
              name="ctaLabel"
              maxLength={80}
              disabled={!editable || busy}
              defaultValue={campaign?.ctaLabel ?? ''}
              className="mt-2 w-full border line px-3 py-3 font-normal"
            />
          </label>
          <label className="block text-sm font-semibold">
            リンク先
            <input
              name="ctaUrl"
              maxLength={2048}
              disabled={!editable || busy}
              defaultValue={campaign?.ctaUrl ?? ''}
              placeholder="/products/... または https://..."
              className="mt-2 w-full border line px-3 py-3 font-normal"
            />
          </label>
        </div>
        {canSchedule ? (
          <label className="block text-sm font-semibold">
            配信日時（JST）
            <input
              name="scheduledAt"
              type="datetime-local"
              disabled={!editable || busy}
              defaultValue={toJstInputValue(
                campaign?.scheduledAt?.toString() ?? null,
              )}
              className="mt-2 block border line px-3 py-3 font-normal"
            />
          </label>
        ) : null}
        {feedback ? (
          <p
            role={feedback.kind === 'error' ? 'alert' : 'status'}
            className={
              feedback.kind === 'error'
                ? 'text-sm text-[#6d2227]'
                : 'text-sm text-emerald-700'
            }
          >
            {feedback.text}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-3 border-t line pt-6">
          {editable ? (
            <button
              type="submit"
              disabled={busy || uploading}
              className="btn bg-[#171412] text-white"
            >
              {busy ? '処理中…' : '保存'}
            </button>
          ) : null}
          <button
            type="button"
            disabled={busy || uploading}
            onClick={(event) => void openPreview(event.currentTarget.form!)}
            className="btn btn-outline"
          >
            プレビュー
          </button>
          {editable && campaign ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={(event) =>
                  void action('test', event.currentTarget.form!)
                }
                className="btn btn-outline"
              >
                テスト送信
              </button>
              {canSchedule ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={(event) =>
                    void action('schedule', event.currentTarget.form!)
                  }
                  className="btn btn-outline"
                >
                  予約する
                </button>
              ) : null}
              <button
                type="button"
                disabled={busy || !canSchedule}
                onClick={(event) =>
                  void action('send-now', event.currentTarget.form!)
                }
                className="btn bg-[#6f1831] text-white"
              >
                今すぐ送信
              </button>
              {canCancel ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={(event) =>
                    void action('cancel', event.currentTarget.form!)
                  }
                  className="btn btn-outline"
                >
                  予約をキャンセル
                </button>
              ) : null}
            </>
          ) : null}
        </div>
      </form>
      {campaign ? (
        <section className="mt-8 border line bg-[#faf8f4] p-6">
          <h2 className="serif text-2xl">配信結果</h2>
          <dl className="mt-5 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div>
              <dt>対象</dt>
              <dd className="mt-1 text-xl">{campaign.metrics.target}</dd>
            </div>
            <div>
              <dt>待機中</dt>
              <dd className="mt-1 text-xl">{campaign.metrics.pending}</dd>
            </div>
            <div>
              <dt>送信済み</dt>
              <dd className="mt-1 text-xl">{campaign.metrics.sent}</dd>
            </div>
            <div>
              <dt>配信済み</dt>
              <dd className="mt-1 text-xl">{campaign.metrics.delivered}</dd>
            </div>
            <div>
              <dt>失敗</dt>
              <dd className="mt-1 text-xl">{campaign.metrics.failed}</dd>
            </div>
            <div>
              <dt>スキップ</dt>
              <dd className="mt-1 text-xl">{campaign.metrics.skipped}</dd>
            </div>
          </dl>
          <p className="mt-5 text-xs text-stone-500">
            送信済みはProvider受付済み、配信済みはWebhookで到達を確認した件数です。
          </p>
        </section>
      ) : null}
      {preview ? (
        <section className="mt-8">
          <h2 className="serif text-2xl">メールプレビュー</h2>
          <iframe
            title="ニュースレタープレビュー"
            className="mt-4 h-[640px] w-full border bg-white"
            srcDoc={preview}
          />
        </section>
      ) : null}
    </div>
  );
}
