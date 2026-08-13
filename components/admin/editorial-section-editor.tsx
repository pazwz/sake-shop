'use client';

import { useEffect, useRef, useState } from 'react';
import { CollectionImageUpload } from '@/components/admin/collection-image-upload';
import { EDITORIAL_SECTION_LIMIT } from '@/config/editorial';

type ProductOption = {
  id: string;
  name: string;
  producer: string | null;
};

type EditorialSectionItem = {
  id?: string;
  clientKey: string;
  title: string;
  body: string;
  imageUrl: string;
  productId: string;
};

type Feedback = { kind: 'success' | 'error'; text: string };

const readError = async (response: Response, fallback: string) => {
  try {
    const payload = (await response.json()) as { error?: { detail?: string } };
    return payload.error?.detail ?? fallback;
  } catch {
    return fallback;
  }
};

const createEmptySection = (): EditorialSectionItem => ({
  clientKey: crypto.randomUUID(),
  title: '',
  body: '',
  imageUrl: '',
  productId: '',
});

export function EditorialSectionEditor({
  collectionId,
  initialSections,
}: {
  collectionId: string;
  initialSections: Array<{
    id: string;
    title: string;
    body: string;
    imageUrl: string | null;
    productId: string | null;
  }>;
}) {
  const editorRef = useRef<HTMLElement>(null);
  const busyRef = useRef(false);
  const [sections, setSections] = useState<EditorialSectionItem[]>(
    initialSections.map((section) => ({
      ...section,
      clientKey: section.id,
      imageUrl: section.imageUrl ?? '',
      productId: section.productId ?? '',
    })),
  );
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [uploadingKeys, setUploadingKeys] = useState<Set<string>>(new Set());
  const [confirmingKey, setConfirmingKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const response = await fetch('/api/v1/products?limit=100');
        if (!response.ok) throw new Error('Unable to load products.');
        const payload = (await response.json()) as {
          data?: { items?: ProductOption[] };
        };
        setProducts(payload.data?.items ?? []);
      } catch {
        setFeedback({
          kind: 'error',
          text: '商品一覧を読み込めませんでした。ページを再読み込みしてください。',
        });
      }
    };
    void loadProducts();
  }, []);

  const update = (
    clientKey: string,
    field: 'title' | 'body' | 'imageUrl' | 'productId',
    value: string,
  ) => {
    setSections((current) =>
      current.map((section) =>
        section.clientKey === clientKey
          ? { ...section, [field]: value }
          : section,
      ),
    );
    setFeedback(null);
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= sections.length) return;
    const next = [...sections];
    [next[index], next[target]] = [next[target], next[index]];
    setSections(next);
    setFeedback(null);
  };

  const setUploading = (clientKey: string, uploading: boolean) => {
    setUploadingKeys((current) => {
      const next = new Set(current);
      if (uploading) next.add(clientKey);
      else next.delete(clientKey);
      return next;
    });
  };

  const save = async () => {
    if (busyRef.current || uploadingKeys.size) return;
    const invalidIndex = sections.findIndex(
      (section) => !section.title.trim() || !section.body.trim(),
    );
    if (invalidIndex >= 0) {
      setFeedback({
        kind: 'error',
        text: `Section ${String(invalidIndex + 1).padStart(2, '0')} の小タイトルと本文を入力してください。`,
      });
      const invalid = sections[invalidIndex];
      const field = invalid.title.trim() ? 'body' : 'title';
      editorRef.current
        ?.querySelector<HTMLElement>(
          `[data-section-key="${invalid.clientKey}"] [name="${field}"]`,
        )
        ?.focus();
      return;
    }

    busyRef.current = true;
    setSaving(true);
    setFeedback(null);
    try {
      const response = await fetch(
        `/api/v1/admin/collections/${collectionId}/editorial-sections`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sections: sections.map((section) => ({
              ...(section.id ? { id: section.id } : {}),
              title: section.title,
              body: section.body,
              imageUrl: section.imageUrl || null,
              productId: section.productId || null,
            })),
          }),
        },
      );
      if (!response.ok) {
        setFeedback({
          kind: 'error',
          text: await readError(
            response,
            '記事内容を保存できませんでした。もう一度お試しください。',
          ),
        });
        return;
      }
      const payload = (await response.json()) as {
        data?: Array<{
          id: string;
          title: string;
          body: string;
          imageUrl: string | null;
          productId: string | null;
        }>;
      };
      const savedSections = payload.data;
      if (!savedSections) {
        setFeedback({ kind: 'error', text: '保存結果を読み取れませんでした。' });
        return;
      }
      setSections((current) =>
        savedSections.map((section, index) => ({
          ...section,
          clientKey: current[index]?.clientKey ?? section.id,
          imageUrl: section.imageUrl ?? '',
          productId: section.productId ?? '',
        })),
      );
      setConfirmingKey(null);
      setFeedback({ kind: 'success', text: '記事内容を保存しました。' });
    } catch {
      setFeedback({
        kind: 'error',
        text: '通信に失敗しました。時間をおいてもう一度お試しください。',
      });
    } finally {
      busyRef.current = false;
      setSaving(false);
    }
  };

  return (
    <section ref={editorRef} className="mx-auto mt-16 max-w-5xl border-t line pt-12">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="eyebrow">EDITORIAL ARTICLE</p>
          <h2 className="serif mt-3 text-3xl">記事内容</h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-stone-600">
            小タイトル、本文、任意の画像と重点商品を設定します。公開ページのレイアウトは表示順に応じて自動で整います。
          </p>
        </div>
        <p className="text-xs text-stone-500">現在 {sections.length} Section</p>
      </div>

      {feedback ? (
        <p
          className={`mt-6 border p-4 text-sm ${
            feedback.kind === 'success'
              ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
              : 'border-[#6d2227] bg-red-50 text-[#6d2227]'
          }`}
          role={feedback.kind === 'error' ? 'alert' : 'status'}
        >
          {feedback.text}
        </p>
      ) : null}

      <div className="mt-8 space-y-8">
        {sections.map((section, index) => (
          <article
            key={section.clientKey}
            data-section-key={section.clientKey}
            className="border line bg-white p-6 md:p-8"
          >
            <div className="flex flex-wrap items-center justify-between gap-4 border-b line pb-5">
              <p className="serif text-xl">
                Section {String(index + 1).padStart(2, '0')}
              </p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={saving || index === 0}
                  onClick={() => move(index, -1)}
                  className="border line px-3 py-2 text-xs disabled:opacity-30"
                  aria-label={`Section ${index + 1}を上へ移動`}
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={saving || index === sections.length - 1}
                  onClick={() => move(index, 1)}
                  className="border line px-3 py-2 text-xs disabled:opacity-30"
                  aria-label={`Section ${index + 1}を下へ移動`}
                >
                  ↓
                </button>
                {confirmingKey === section.clientKey ? (
                  <span className="flex items-center gap-2 text-xs">
                    <span>削除しますか？</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSections((current) =>
                          current.filter(
                            (item) => item.clientKey !== section.clientKey,
                          ),
                        );
                        setConfirmingKey(null);
                        setFeedback(null);
                      }}
                      className="font-semibold text-[#6d2227] underline"
                    >
                      削除する
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingKey(null)}
                      className="text-stone-500 underline"
                    >
                      戻る
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => setConfirmingKey(section.clientKey)}
                    className="text-xs text-[#6d2227] underline"
                  >
                    削除
                  </button>
                )}
              </div>
            </div>

            <div className="mt-6 grid gap-6">
              <label className="text-sm">
                小タイトル
                <input
                  name="title"
                  value={section.title}
                  onChange={(event) =>
                    update(section.clientKey, 'title', event.target.value)
                  }
                  className="mt-2 w-full border line bg-white p-3"
                />
              </label>
              <label className="text-sm">
                本文
                <textarea
                  name="body"
                  rows={7}
                  value={section.body}
                  onChange={(event) =>
                    update(section.clientKey, 'body', event.target.value)
                  }
                  className="mt-2 w-full border line bg-white p-3 leading-7"
                />
              </label>
              <CollectionImageUpload
                name={`sectionImage-${section.clientKey}`}
                label="セクション画像（任意）"
                description="1枚の主画像をアップロードすると、公開ページで自動的に最適化されます。"
                initialUrl={section.imageUrl}
                onUploadingChange={(uploading) =>
                  setUploading(section.clientKey, uploading)
                }
                onUrlChange={(url) =>
                  update(section.clientKey, 'imageUrl', url)
                }
              />
              <label className="text-sm">
                重点商品（任意）
                <select
                  value={section.productId}
                  onChange={(event) =>
                    update(section.clientKey, 'productId', event.target.value)
                  }
                  className="mt-2 w-full border line bg-white p-3"
                >
                  <option value="">商品を設定しない</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                      {product.producer ? ` / ${product.producer}` : ''}
                    </option>
                  ))}
                </select>
                <span className="mt-2 block text-xs leading-6 text-stone-500">
                  ここで選ぶ商品は記事内の重点表示専用です。特集末尾の商品順には影響しません。
                </span>
              </label>
            </div>
          </article>
        ))}
      </div>

      {sections.length < EDITORIAL_SECTION_LIMIT ? (
        <button
          type="button"
          disabled={saving}
          onClick={() => {
            setSections((current) => [...current, createEmptySection()]);
            setFeedback(null);
          }}
          className="btn btn-outline mt-8"
        >
          ＋ セクションを追加
        </button>
      ) : (
        <p className="mt-8 text-xs text-stone-500">
          記事 Section は最大{EDITORIAL_SECTION_LIMIT}件です。
        </p>
      )}

      <div className="mt-8">
        <button
          type="button"
          disabled={saving || uploadingKeys.size > 0}
          onClick={() => void save()}
          className="btn disabled:opacity-50"
        >
          {saving
            ? '保存中...'
            : uploadingKeys.size
              ? '画像アップロード中...'
              : '記事内容を保存'}
        </button>
      </div>
    </section>
  );
}
