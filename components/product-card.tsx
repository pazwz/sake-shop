import Image from 'next/image';
import Link from 'next/link';
import { formatPrice } from '@/lib/products';

export interface ProductCardItem {
  id: string | number;
  slug: string;
  name: string;
  category: string | { name: string };
  producer: string | null;
  price: number;
  image?: string;
  images?: Array<{ imageUrl: string }>;
  recommendationTags?: string[];
}

export function ProductCard({ product }: { product: ProductCardItem }) {
  const imageUrl = product.images?.[0]?.imageUrl ?? product.image;
  const categoryName =
    typeof product.category === 'string'
      ? product.category
      : product.category.name;

  return (
    <Link
      href={`/products/${product.slug}`}
      className="product-card group block"
      data-reveal
    >
      <div className="product-card-image relative aspect-[4/5] overflow-hidden bg-[#f3f0ea]">
        {imageUrl ? (
          <Image
            fill
            sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 33vw"
            className="object-cover"
            src={imageUrl}
            alt={product.name}
          />
        ) : null}
        {product.recommendationTags?.[0] ? (
          <span className="absolute left-3 top-3 bg-[#fffdf9]/90 px-2 py-1 text-[9px] tracking-wider text-[#6d2227]">
            {product.recommendationTags[0]}
          </span>
        ) : null}
      </div>
      <p className="mt-4 text-[10px] tracking-[.15em] text-[#6d2227]">
        {categoryName} / {product.producer ?? 'KURA'}
      </p>
      <h3 className="product-card-title mt-1 text-sm">{product.name}</h3>
      <p className="mt-2 text-sm">
        {formatPrice(product.price)}{' '}
        <span className="text-[10px] text-stone-500">税込</span>
      </p>
    </Link>
  );
}
