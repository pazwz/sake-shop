'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type Collection = {
  id: string;
  type: string;
  title: string;
  status: string;
  displayOrder: number;
  products: unknown[];
};

export default function AdminCollectionsPage() {
  const [collections, setCollections] = useState<Collection[]>([]);
  useEffect(() => {
    void fetch('/api/v1/admin/collections')
      .then((response) => response.json())
      .then((payload: { data?: Collection[] }) =>
        setCollections(payload.data ?? []),
      );
  }, []);
  return (
    <main className="wrap py-16">
      <div className="flex items-end justify-between gap-4">
        <div>
          <Link href="/admin" className="text-xs text-stone-500">
            ← 管理トップ
          </Link>
          <h1 className="serif mt-4 text-5xl">コレクション</h1>
        </div>
        <Link
          href="/admin/collections/new"
          className="btn bg-[#171412] text-white"
        >
          新規作成
        </Link>
      </div>
      <div className="mt-10 divide-y line border-y line">
        {collections.map((collection) => (
          <Link
            key={collection.id}
            href={`/admin/collections/${collection.id}`}
            className="flex items-center justify-between gap-4 py-5 hover:text-[#6d2227]"
          >
            <div>
              <p className="text-xs tracking-wider text-stone-500">
                {collection.type} · {collection.status}
              </p>
              <h2 className="serif mt-1 text-2xl">{collection.title}</h2>
            </div>
            <p className="text-xs text-stone-500">
              商品 {collection.products.length} / 順番 {collection.displayOrder}
              　→
            </p>
          </Link>
        ))}
      </div>
    </main>
  );
}
