'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { SITE_SOCIAL_LINKS } from '@/config/site';
type IconName = 'instagram' | 'xiaohongshu';
const socialLinks: { label: string; href: string; icon: IconName }[] = [
  { label: 'Instagram', href: SITE_SOCIAL_LINKS.instagram, icon: 'instagram' },
  { label: '小紅書', href: SITE_SOCIAL_LINKS.xiaohongshu, icon: 'xiaohongshu' },
];
export function Footer() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <footer className="border-t line bg-[#f3f0ea]">
        <div className="wrap grid gap-12 py-16 md:grid-cols-2 lg:grid-cols-[1.1fr_.8fr_1fr_1fr]">
          <div>
            <p className="serif text-3xl tracking-[.2em]">KURA</p>
            <p className="mt-5 text-xs leading-6 text-stone-600">
              つくり手の美意識を、食卓へ。
              <br />
              東京都新宿区神楽坂 3-12
            </p>
            <p className="mt-5 text-[10px] leading-5 text-stone-500">
              通信販売酒類小売業免許取得済
              <br />
              免許情報はお客様承認後に掲載予定です。
            </p>
          </div>
          <div className="text-sm leading-9">
            <p className="eyebrow">SHOP</p>
            <Link href="/products" className="mt-3 block">
              商品一覧
            </Link>
            <Link href="/cart" className="block">
              ご注文・配送について
            </Link>
            <Link href="/about" className="block">
              私たちについて
            </Link>
            <Link href="/contact" className="block">
              お問い合わせ
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
              TEL　00-0000-0000
              <br />
              MAIL　info@example.com
              <br />
              営業時間　10:00–18:00
            </p>
            <p className="mt-7 text-xs font-bold">フォローする</p>
            <div className="mt-4 flex flex-wrap gap-3">
              {socialLinks.map((link) =>
                link.href ? (
                  <a
                    key={link.label}
                    href={link.href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`${link.label}を新しいタブで開く`}
                    className="social-link"
                  >
                    <SocialIcon name={link.icon} />
                    <span>{link.label}</span>
                  </a>
                ) : (
                  <span
                    key={link.label}
                    aria-label={`${link.label}（リンク準備中）`}
                    className="social-link cursor-default opacity-60"
                  >
                    <SocialIcon name={link.icon} />
                    <span>{link.label}</span>
                  </span>
                ),
              )}
            </div>
          </div>
        </div>
        <div className="border-t line">
          <div className="wrap flex flex-wrap justify-between gap-4 py-6 text-[10px] text-stone-500">
            <span>20歳未満の飲酒は法律で禁止されています。</span>
            <span>© 2026 KURA SELECT SHOP</span>
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
  const [submitted, setSubmitted] = useState(false);
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
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    setForm({
      email: '',
      gender: '',
      lastName: '',
      firstName: '',
      lastKana: '',
      firstKana: '',
    });
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
            <p className="eyebrow">KURA NEWSLETTER</p>
            <h2 id="newsletter-title" className="serif mt-5 text-4xl">
              ニュースレター
            </h2>
            <p className="mt-5 text-sm leading-8 text-stone-600">
              季節のおすすめ、新入荷商品、蔵元の物語などをお届けします。
            </p>
            <form onSubmit={submit} className="mt-9 space-y-6">
              <Field label="Eメールアドレス（必須）">
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(event) =>
                    setForm({ ...form, email: event.target.value })
                  }
                  className="input"
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
                <Field label="姓（必須）">
                  <input
                    required
                    value={form.lastName}
                    onChange={(event) =>
                      setForm({ ...form, lastName: event.target.value })
                    }
                    className="input"
                  />
                </Field>
                <Field label="名（必須）">
                  <input
                    required
                    value={form.firstName}
                    onChange={(event) =>
                      setForm({ ...form, firstName: event.target.value })
                    }
                    className="input"
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-5">
                <Field label="姓（全角カナ）">
                  <input
                    pattern="[ァ-ヶー　]+"
                    value={form.lastKana}
                    onChange={(event) =>
                      setForm({ ...form, lastKana: event.target.value })
                    }
                    className="input"
                  />
                </Field>
                <Field label="名（全角カナ）">
                  <input
                    pattern="[ァ-ヶー　]+"
                    value={form.firstKana}
                    onChange={(event) =>
                      setForm({ ...form, firstKana: event.target.value })
                    }
                    className="input"
                  />
                </Field>
              </div>
              <p className="text-[11px] leading-5 text-stone-500">
                ご入力いただいた情報は、ニュースレター配信に関するご案内のために利用します。これはデモフォームであり、実際の登録・メール送信は行われません。
              </p>
              <button className="btn w-full">登録</button>
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
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-xs font-semibold">
      {label}
      <span className="mt-2 block">{children}</span>
    </label>
  );
}
function SocialIcon({ name }: { name: IconName }) {
  if (name === 'instagram')
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
  return (
    <span className="text-[9px] font-bold tracking-[.08em]" aria-hidden="true">
      RED
    </span>
  );
}
