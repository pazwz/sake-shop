'use client';

export default function AccountError({ reset }: { reset: () => void }) {
  return (
    <main className="wrap py-20">
      <p className="eyebrow">Account error</p>
      <h1 className="serif mt-4 text-4xl">マイページを表示できませんでした</h1>
      <p className="mt-6 text-sm text-stone-600">
        通信状況をご確認のうえ、もう一度お試しください。
      </p>
      <button type="button" className="btn mt-8" onClick={reset}>
        もう一度試す
      </button>
    </main>
  );
}
