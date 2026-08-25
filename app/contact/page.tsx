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

const topics = [
  '商品について',
  '配送について',
  'ご注文前のご相談',
  '注文内容の変更・キャンセル',
  'その他',
];

type ContactErrors = { email?: string; message?: string };

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
  const [topic, setTopic] = useState(
    params.get('order') ? '注文内容の変更・キャンセル' : '商品について',
  );
  const [email, setEmail] = useState(member?.email ?? '');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<ContactErrors>({});
  const order = params.get('order');

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
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
    setSent(true);
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
          内容を確認のうえ、通常2営業日以内にメールでご返信します。ご注文の変更・キャンセルは、発送状況によりご希望に添えない場合があります。
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
              onChange={(event) => setTopic(event.target.value)}
            >
              {topics.map((value) => (
                <option key={value}>{value}</option>
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
                topic === '注文内容の変更・キャンセル'
                  ? 'ご希望の内容と理由をご記入ください。'
                  : 'ご質問・ご相談内容をご記入ください。'
              }
            />
            <FormFieldError
              id="contact-message-error"
              message={errors.message}
            />
          </label>
          <p className="text-[11px] leading-5 text-stone-500">
            これはデモフォームです。送信内容は実際にはメール送信されません。
          </p>
          <button className="btn">送信する</button>
        </form>
      </div>
    </div>
  );
}
