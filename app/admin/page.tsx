import Link from 'next/link';

export default function AdminPage() {
  return (
    <main className="wrap py-20">
      <p className="eyebrow">ADMIN CMS · DEMO</p>
      <h1 className="serif mt-4 text-5xl">コンテンツ管理</h1>
      <p className="mt-5 max-w-xl text-sm leading-7 text-stone-600">
        ホームページの Hero
        と特集を管理します。商品、価格、在庫には変更を加えません。
      </p>
      <Link
        href="/admin/collections"
        className="btn mt-8 bg-[#171412] text-white"
      >
        コレクションを管理
      </Link>
    </main>
  );
}
