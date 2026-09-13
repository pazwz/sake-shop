import Link from 'next/link';

export default function CustomerOrderSafetyGate() {
  return (
    <main className="wrap py-20">
      <p className="eyebrow">ORDER DETAILS</p>
      <h1 className="serif mt-4 text-4xl sm:text-5xl">
        ご注文詳細は現在表示できません
      </h1>
      <p className="mt-6 max-w-2xl text-sm leading-7 text-stone-600">
        お客様の個人情報を保護するため、安全なログイン機能の準備が整うまで注文詳細の表示を停止しています。
      </p>
      <Link className="btn-secondary mt-8 inline-flex" href="/">
        トップページへ戻る
      </Link>
    </main>
  );
}
