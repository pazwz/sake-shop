'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { ProductCard } from '@/components/product-card';
import { QuantitySelector } from '@/components/quantity-selector';
import { useCart } from '@/components/cart-provider';
import { formatPrice } from '@/lib/products';
import { getProduct, getProducts } from '@/lib/product-api';
import type { ProductRecord } from '@/types/product';

export default function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { add } = useCart();
  const [product, setProduct] = useState<ProductRecord | null>(null);
  const [related, setRelated] = useState<ProductRecord[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    setNotFound(false);
    void getProduct(slug)
      .then((item) => {
        setProduct(item);
        const category = item.category.parent?.slug ?? item.category.slug;
        return getProducts(
          new URLSearchParams({ category, limit: '4', sort: 'recommended' }),
        );
      })
      .then((result) =>
        setRelated(
          result.items.filter((item) => item.slug !== slug).slice(0, 3),
        ),
      )
      .catch(() => setNotFound(true))
      .finally(() => setIsLoading(false));
  }, [slug]);

  const inventory = useMemo(
    () =>
      product?.inventory.reduce(
        (total, item) => total + item.availableQuantity,
        0,
      ) ?? 0,
    [product],
  );
  const imageUrl = product?.images[0]?.imageUrl;

  if (isLoading)
    return (
      <div className="wrap py-28 text-center text-sm text-stone-500">
        商品を読み込んでいます。
      </div>
    );
  if (notFound || !product)
    return (
      <div className="wrap py-28 text-center text-sm text-stone-500">
        商品が見つかりませんでした。
      </div>
    );

  const cartProduct = {
    id: product.id,
    slug: product.slug,
    name: product.name,
    category: product.category.name,
    producer: product.producer,
    price: product.price,
    image: imageUrl ?? '',
  };

  return (
    <div className="wrap py-10 md:py-16">
      <Link href="/products" className="text-xs text-stone-500">
        ← 商品一覧へ
      </Link>
      <div className="mt-8 grid gap-10 md:grid-cols-2 md:gap-16">
        <div className="relative aspect-[4/5] bg-[#29261f]">
          {imageUrl ? (
            <Image
              fill
              sizes="(max-width: 767px) 100vw, 50vw"
              loading="eager"
              className="object-cover"
              src={imageUrl}
              alt={product.name}
            />
          ) : null}
        </div>
        <div className="md:pt-8">
          <p className="eyebrow">{product.productCode}</p>
          <h1 className="serif mt-4 text-4xl md:text-5xl">{product.name}</h1>
          <p className="mt-4 text-sm text-stone-600">
            {product.producer} / {product.origin}
          </p>
          <p className="mt-8 text-2xl">
            {formatPrice(product.price)}{' '}
            <span className="text-xs text-stone-500">税込</span>
          </p>
          <p
            className={`mt-5 text-xs ${inventory > 0 ? 'text-[#c7a463]' : 'text-red-400'}`}
          >
            {inventory > 0
              ? `在庫あり — 通常2〜4日で発送（残り ${inventory} 点）`
              : '現在完売しています'}
          </p>
          {inventory > 0 ? (
            <div className="mt-8 flex gap-3">
              <QuantitySelector value={quantity} onChange={setQuantity} />
              <button
                className="btn flex-1"
                onClick={() => add(cartProduct, quantity)}
              >
                バッグに入れる
              </button>
            </div>
          ) : null}
          <div className="mt-12 border-t line pt-8">
            <p className="eyebrow">ABOUT THIS BOTTLE</p>
            <p className="mt-5 text-sm leading-8 text-stone-600">
              {product.description}
            </p>
          </div>
          <div className="mt-10 border-t line pt-8">
            <p className="eyebrow">TASTING NOTES</p>
            <p className="mt-5 text-sm leading-8 text-stone-600">
              {product.tastingNotes}
            </p>
          </div>
          <div className="mt-10 border-t line pt-8">
            <p className="eyebrow">DETAIL</p>
            <dl className="mt-5 grid grid-cols-2 gap-y-4 text-sm">
              <dt>カテゴリー</dt>
              <dd>{product.category.name}</dd>
              <dt>産地</dt>
              <dd>{product.origin}</dd>
              <dt>容量</dt>
              <dd>{product.volume}</dd>
              <dt>アルコール度数</dt>
              <dd>
                {product.alcoholPercentage
                  ? `${product.alcoholPercentage}%`
                  : '—'}
              </dd>
              <dt>蔵元・生産者</dt>
              <dd>{product.producer}</dd>
            </dl>
          </div>
        </div>
      </div>
      {related.length > 0 ? (
        <section className="py-24">
          <p className="eyebrow">YOU MAY ALSO LIKE</p>
          <h2 className="serif mt-4 text-3xl">同じカテゴリーの商品</h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-3">
            {related.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
