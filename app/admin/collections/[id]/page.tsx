'use client';

import { useEffect, useState } from 'react';
import { CollectionForm } from '@/components/admin/collection-form';

type Collection = Parameters<typeof CollectionForm>[0]['collection'];

export default function CollectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [collection, setCollection] = useState<Collection>();
  useEffect(() => {
    const loadCollection = async () => {
      const { id } = await params;
      const response = await fetch('/api/v1/admin/collections');
      const payload = (await response.json()) as {
        data?: NonNullable<Collection>[];
      };
      setCollection(payload.data?.find((item) => item.id === id));
    };
    void loadCollection();
  }, [params]);
  if (!collection)
    return (
      <main className="wrap py-16 text-sm text-stone-600">読み込み中…</main>
    );
  return (
    <main className="wrap py-16">
      <CollectionForm collection={collection} />
    </main>
  );
}
