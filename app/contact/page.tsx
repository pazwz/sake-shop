'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useRef, useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { FormFieldError } from '@/components/form-field-error';
import { siteConfig } from '@/config/site';
import {
  focusFormField,
  invalidFieldClass,
  isValidEmail,
} from '@/lib/form-validation';
import { CONTACT_TOPICS, type ContactTopic } from '@/types/contact';

const topics = Object.entries(CONTACT_TOPICS) as Array<
  [ContactTopic, string]
>;

type ContactErrors = { email?: string; message?: string; server?: string };

const createSubmissionId = () => crypto.randomUUID();

export default function Contact() {
  return (
    <Suspense fallback={null}>
      <ContactForm />
    </Suspense>
  );
}

function ContactForm() {
  const params = useSearchParams();
  const { member } = useAuth();
  const formRef = useRef<HTMLFormElement>(null);
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submissionId, setSubmissionId] = useState(createSubmissionId);
  const [topic, setTopic] = useState(
    params.get('order') ? 'ORDER_CHANGE_CANCEL' : 'PRODUCT',
  );
  const [email, setEmail] = useState(member?.email ?? '');
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState('');
  const [errors, setErrors] = useState<ContactErrors>({});
  const order = params.get('order');

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: ContactErrors = {};
    if (!email.trim()) nextErrors.email = 'メールアドレスを入力してください。';
    else if (!isValidEmail(email))
      nextErrors.email = 'メールアドレスの形式が正しくありません。';
    if (!message.trim())
      nextErrors.message = 'お問い合わせ内容を入力してください。';
    const firstField = nextErrors.email
      ? 'email'
      : nextErrors.message
        ? 'message'
        : null;
    if (firstField) {
      setErrors(nextErrors);
      if (formRef.current) focusFormField(formRef.current, firstField);
      return;
    }
    setSubmitting(true);
    setErrors({});
    try {
      const response = await fetch('/api/v1/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId,
          topic,
          email,
          message,
          ...(order?.trim() ? { orderNumber: order.trim() } : {}),
          website,
        }),
      });
      const payload = (await response.json()) as {
        success?: boolean;
        error?: { code?: string; detail?: string };
      };
      if (!response.ok || !payload.success) {
        setErrors({
          server:
            payload.error?.code === 'CONTACT_UNAVAILABLE'
              ? '現在お問い合わせフォームをご利用いただけません。お電話でお問い合わせください。'
              : '送信できませんでした。時間をおいて再度お試しください。',
        });
        return;
      }
      setSent(true);
      setSubmissionId(createSubmissionId());
    } catch {
      setErrors({
        server: '送信できませんでした。時間をおいて再度お試しください。',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (sent)
    return (
      <div className="wrap flex min-h-[60vh] max-w-2xl flex-col justify-center py-20">
        <p className="eyebrow">Message received</p>
        <h1 className="serif mt-5 text-5xl">
          お問い合わせを
          <br />
          承りました。
        </h1>
        <p className="mt-7 text-sm leading-8 text-stone-600">
          内容を確認のうえ、ご連絡いたします。お問い合わせの送信だけでは、ご注文の変更・キャンセルは確定しません。
        </p>
      </div>
    );

  return (
    <div className="wrap py-16 md:py-24">
      <div className="grid gap-14 lg:grid-cols-[0.75fr_1.25fr] lg:gap-20">
        <div>
          <p className="eyebrow">Contact</p>
          <h1 className="serif mt-4 text-5xl">お問い合わせ</h1>
          <p className="mt-6 text-sm leading-7 text-stone-600">
            商品選びや配送に関するご相談、ご注文後のお問い合わせを承ります。
            {order ? (
              <>
                <br />
                対象のご注文：<span className="font-medium">{order}</span>
              </>
            ) : null}
          </p>
          <div className="mt-10 border-t line pt-6 text-sm leading-8 text-stone-600">
            <p className="font-semibold text-[#171412]">
              {siteConfig.storeName}
            </p>
            <p className="mt-2">{siteConfig.address.full}</p>
            <p>
              TEL　
              <a
                className="underline-offset-4 hover:underline"
                href={siteConfig.phone.href}
              >
                {siteConfig.phone.display}
              </a>
            </p>
            <p>営業時間　{siteConfig.businessHours}</p>
          </div>
        </div>
        <form ref={formRef} noValidate onSubmit={submit} className="space-y-6">
          <label className="block text-xs">
            お問い合わせ種別
            <select
              className="input mt-2"
              value={topic}
              onChange={(event) => setTopic(event.target.value as ContactTopic)}
            >
              {topics.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs">
            メールアドレス
            <input
              required
              type="email"
              name="email"
              value={email}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={
                errors.email ? 'contact-email-error' : undefined
              }
              className={`input mt-2 ${errors.email ? invalidFieldClass : ''}`}
              onChange={(event) => {
                setEmail(event.target.value);
                setErrors((current) => ({ ...current, email: undefined }));
              }}
            />
            <FormFieldError id="contact-email-error" message={errors.email} />
          </label>
          <label className="block text-xs">
            お問い合わせ内容
            <textarea
              required
              name="message"
              value={message}
              aria-invalid={Boolean(errors.message)}
              aria-describedby={
                errors.message ? 'contact-message-error' : undefined
              }
              onChange={(event) => {
                setMessage(event.target.value);
                setErrors((current) => ({ ...current, message: undefined }));
              }}
              className={`mt-2 min-h-40 w-full border bg-transparent p-3 outline-none focus:border-[#bc9b5d] ${errors.message ? invalidFieldClass : 'border-stone-300'}`}
              placeholder={
                topic === 'ORDER_CHANGE_CANCEL'
                  ? 'ご希望の内容と理由をご記入ください。'
                  : 'ご質問・ご相談内容をご記入ください。'
              }
            />
            <FormFieldError
              id="contact-message-error"
              message={errors.message}
            />
          </label>
          <input
            aria-hidden="true"
            autoComplete="off"
            className="absolute h-px w-px overflow-hidden opacity-0"
            name="website"
            tabIndex={-1}
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
          />
          <p className="text-[11px] leading-5 text-stone-500">
            お問い合わせの送信だけでは、ご注文の変更・キャンセルは確定しません。
          </p>
          <FormFieldError id="contact-server-error" message={errors.server} />
          <button className="btn" disabled={submitting}>
            {submitting ? '送信中...' : '送信する'}
          </button>
        </form>
      </div>
    </div>
  );
}
