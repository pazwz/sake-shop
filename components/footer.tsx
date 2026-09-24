'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { siteConfig } from '@/config/site';
import { BrandLogo } from '@/components/brand-logo';
import { AgeNotice } from '@/components/age-notice';
import { FormFieldError } from '@/components/form-field-error';
import {
  focusFormField,
  invalidFieldClass,
  isValidEmail,
} from '@/lib/form-validation';
type NewsletterErrors = Partial<
  Record<'email' | 'lastName' | 'firstName' | 'lastKana' | 'firstKana', string>
>;
export function Footer() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <footer className="border-t line bg-[#f3f0ea]">
        <div className="wrap grid gap-12 py-16 md:grid-cols-2 lg:grid-cols-[1.1fr_.8fr_1fr_1fr]">
          <div>
            <BrandLogo variant="footer" showLocation />
            <p className="mt-5 text-xs leading-6 text-stone-600">
              つくり手の美意識を、食卓へ。
              <br />
              {siteConfig.storeName}
              <br />
              {siteConfig.address.line1}
              <br />
              {siteConfig.address.line2}
            </p>
            <p className="mt-5 text-[10px] leading-5 text-stone-500">
              通信販売酒類小売業免許取得済
            </p>
          </div>
          <div className="text-sm leading-9">
            <p className="eyebrow">SHOP</p>
            <Link href="/products" className="mt-3 block">
              商品一覧
            </Link>
            <Link href="/shipping-returns" className="block">
              ご注文・配送について
            </Link>
            <Link href="/about" className="block">
              私たちについて
            </Link>
            <Link href="/contact" className="block">
              ご利用ガイド・お問い合わせ
            </Link>
          </div>
          <div>
            <p className="eyebrow">NEWSLETTER</p>
            <p className="mt-4 text-sm leading-7 text-stone-600">
              季節の便りと、新しい一本をお届けします。
            </p>
            <button
              onClick={() => setOpen(true)}
              className="btn btn-outline mt-6 w-full"
            >
              ニュースレターに登録
            </button>
          </div>
          <div>
            <p className="eyebrow">SUPPORT</p>
            <p className="mt-4 text-sm leading-8 text-stone-600">
              TEL　
              <a href={siteConfig.phone.href}>{siteConfig.phone.display}</a>
              <br />
              営業時間　{siteConfig.businessHours}
            </p>
            <p className="mt-7 text-xs font-bold">フォローする</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <a
                href={siteConfig.instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="social-link"
              >
                <InstagramIcon />
                <span>Instagram</span>
              </a>
            </div>
          </div>
        </div>
        <div className="border-t line">
          <div className="wrap py-6 text-[10px] text-stone-500">
            <nav
              aria-label="法的情報"
              className="flex flex-wrap gap-x-6 gap-y-2"
            >
              <Link href="/legal/tokusho">特定商取引法に基づく表記</Link>
              <Link href="/privacy">プライバシーポリシー</Link>
              <Link href="/terms">利用規約</Link>
              <Link href="/shipping-returns">配送・返品について</Link>
            </nav>
            <div className="mt-5 flex flex-wrap justify-between gap-4 border-t line pt-5">
              <AgeNotice />
              <span>© 2026 LINXAS FUKUOKA</span>
            </div>
          </div>
        </div>
      </footer>
      <NewsletterDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}
function NewsletterDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [consent, setConsent] = useState(false);
  const [serverError, setServerError] = useState('');
  const [errors, setErrors] = useState<NewsletterErrors>({});
  const [form, setForm] = useState({
    email: '',
    gender: '',
    lastName: '',
    firstName: '',
    lastKana: '',
    firstKana: '',
  });
  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    setTimeout(() => closeRef.current?.focus(), 0);
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);
  if (!open) return null;
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors: NewsletterErrors = {};
    if (!form.email.trim())
      nextErrors.email = 'メールアドレスを入力してください。';
    else if (!isValidEmail(form.email))
      nextErrors.email = 'メールアドレスの形式が正しくありません。';
    if (!form.lastName.trim()) nextErrors.lastName = '姓を入力してください。';
    if (!form.firstName.trim()) nextErrors.firstName = '名を入力してください。';
    if (!consent) {
      setServerError('メール配信への同意が必要です。');
      return;
    }
    const kanaPattern = /^[ァ-ヶー　]+$/;
    if (form.lastKana && !kanaPattern.test(form.lastKana))
      nextErrors.lastKana = '姓は全角カナで入力してください。';
    if (form.firstKana && !kanaPattern.test(form.firstKana))
      nextErrors.firstKana = '名は全角カナで入力してください。';
    const firstField = (
      ['email', 'lastName', 'firstName', 'lastKana', 'firstKana'] as const
    ).find((field) => nextErrors[field]);
    if (firstField) {
      setErrors(nextErrors);
      if (formRef.current) focusFormField(formRef.current, firstField);
      return;
    }
    setErrors({});
    setServerError('');
    setSubmitting(true);
    try {
      const response = await fetch('/api/v1/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, consent }),
      });
      if (!response.ok) {
        const payload = await response.json();
        setServerError(payload.error?.detail ?? '登録に失敗しました。');
        return;
      }
      setSubmitted(true);
      setForm({
        email: '',
        gender: '',
        lastName: '',
        firstName: '',
        lastKana: '',
        firstKana: '',
      });
      setConsent(false);
    } catch {
      setServerError('通信に失敗しました。もう一度お試しください。');
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <div className="fixed inset-0 z-50" role="presentation">
      <button
        aria-label="ニュースレタードロワーを閉じる"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/45"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="newsletter-title"
        className="absolute right-0 top-0 flex h-full w-full max-w-[500px] flex-col overflow-y-auto bg-[#fffdf9] px-7 py-8 shadow-2xl sm:px-10"
      >
        <button
          ref={closeRef}
          onClick={onClose}
          aria-label="閉じる"
          className="absolute right-7 top-7 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#6d2227]"
        >
          閉じる　×
        </button>
        {submitted ? (
          <div className="my-auto">
            <p className="eyebrow">THANK YOU</p>
            <h2 id="newsletter-title" className="serif mt-5 text-4xl">
              ご登録ありがとうございます。
            </h2>
            <p className="mt-6 text-sm leading-8 text-stone-600">
              季節のおすすめ、新入荷商品、蔵元の物語をお届けします。
            </p>
            <button
              className="btn mt-9"
              onClick={() => {
                setSubmitted(false);
                onClose();
              }}
            >
              閉じる
            </button>
          </div>
        ) : (
          <>
            <p className="eyebrow">LINXAS NEWSLETTER</p>
            <h2 id="newsletter-title" className="serif mt-5 text-4xl">
              ニュースレター
            </h2>
            <p className="mt-5 text-sm leading-8 text-stone-600">
              季節のおすすめ、新入荷商品、蔵元の物語などをお届けします。
            </p>
            <form
              ref={formRef}
              noValidate
              onSubmit={submit}
              className="mt-9 space-y-6"
            >
              <Field
                label="Eメールアドレス（必須）"
                errorId="newsletter-email-error"
                error={errors.email}
              >
                <input
                  required
                  type="email"
                  name="email"
                  value={form.email}
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={
                    errors.email ? 'newsletter-email-error' : undefined
                  }
                  onChange={(event) => {
                    setForm({ ...form, email: event.target.value });
                    setErrors((current) => ({ ...current, email: undefined }));
                  }}
                  className={`input ${errors.email ? invalidFieldClass : ''}`}
                />
              </Field>
              <Field label="性別（任意）">
                <select
                  value={form.gender}
                  onChange={(event) =>
                    setForm({ ...form, gender: event.target.value })
                  }
                  className="input"
                >
                  <option value="">選択しない</option>
                  <option>女性</option>
                  <option>男性</option>
                  <option>回答しない</option>
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-5">
                <Field
                  label="姓（必須）"
                  errorId="newsletter-last-name-error"
                  error={errors.lastName}
                >
                  <input
                    required
                    name="lastName"
                    value={form.lastName}
                    aria-invalid={Boolean(errors.lastName)}
                    aria-describedby={
                      errors.lastName ? 'newsletter-last-name-error' : undefined
                    }
                    onChange={(event) => {
                      setForm({ ...form, lastName: event.target.value });
                      setErrors((current) => ({
                        ...current,
                        lastName: undefined,
                      }));
                    }}
                    className={`input ${errors.lastName ? invalidFieldClass : ''}`}
                  />
                </Field>
                <Field
                  label="名（必須）"
                  errorId="newsletter-first-name-error"
                  error={errors.firstName}
                >
                  <input
                    required
                    name="firstName"
                    value={form.firstName}
                    aria-invalid={Boolean(errors.firstName)}
                    aria-describedby={
                      errors.firstName
                        ? 'newsletter-first-name-error'
                        : undefined
                    }
                    onChange={(event) => {
                      setForm({ ...form, firstName: event.target.value });
                      setErrors((current) => ({
                        ...current,
                        firstName: undefined,
                      }));
                    }}
                    className={`input ${errors.firstName ? invalidFieldClass : ''}`}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-5">
                <Field
                  label="姓（全角カナ）"
                  errorId="newsletter-last-kana-error"
                  error={errors.lastKana}
                >
                  <input
                    pattern="[ァ-ヶー　]+"
                    name="lastKana"
                    value={form.lastKana}
                    aria-invalid={Boolean(errors.lastKana)}
                    aria-describedby={
                      errors.lastKana ? 'newsletter-last-kana-error' : undefined
                    }
                    onChange={(event) => {
                      setForm({ ...form, lastKana: event.target.value });
                      setErrors((current) => ({
                        ...current,
                        lastKana: undefined,
                      }));
                    }}
                    className={`input ${errors.lastKana ? invalidFieldClass : ''}`}
                  />
                </Field>
                <Field
                  label="名（全角カナ）"
                  errorId="newsletter-first-kana-error"
                  error={errors.firstKana}
                >
                  <input
                    pattern="[ァ-ヶー　]+"
                    name="firstKana"
                    value={form.firstKana}
                    aria-invalid={Boolean(errors.firstKana)}
                    aria-describedby={
                      errors.firstKana
                        ? 'newsletter-first-kana-error'
                        : undefined
                    }
                    onChange={(event) => {
                      setForm({ ...form, firstKana: event.target.value });
                      setErrors((current) => ({
                        ...current,
                        firstKana: undefined,
                      }));
                    }}
                    className={`input ${errors.firstKana ? invalidFieldClass : ''}`}
                  />
                </Field>
              </div>
              <p className="text-[11px] leading-5 text-stone-500">
                ご入力いただいた情報は、ニュースレター配信に関するご案内のために利用します。
              </p>
              <label className="flex items-start gap-3 text-xs leading-6 text-stone-600">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={consent}
                  onChange={(event) => {
                    setConsent(event.target.checked);
                    setServerError('');
                  }}
                />
                <span>ニュースレターの配信に同意します。</span>
              </label>
              {serverError ? (
                <p className="text-xs text-red-700">{serverError}</p>
              ) : null}
              <button
                disabled={submitting}
                className="btn w-full disabled:opacity-60"
              >
                {submitting ? '登録中…' : '登録'}
              </button>
            </form>
          </>
        )}
      </aside>
    </div>
  );
}
function Field({
  label,
  children,
  errorId,
  error,
}: {
  label: string;
  children: React.ReactNode;
  errorId?: string;
  error?: string;
}) {
  return (
    <label className="block text-xs font-semibold">
      {label}
      <span className="mt-2 block">{children}</span>
      {errorId ? <FormFieldError id={errorId} message={error} /> : null}
    </label>
  );
}
function InstagramIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r=".8" fill="currentColor" />
    </svg>
  );
}
