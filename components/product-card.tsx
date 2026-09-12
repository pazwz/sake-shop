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
      className="product-card group flex w-full min-w-0 max-w-full flex-col"
      data-reveal
    >
      <div className="product-card-image relative aspect-[4/5] w-full min-w-0 max-w-full overflow-hidden bg-white md:aspect-square">
        {imageUrl ? (
          <Image
            fill
            sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 33vw"
            className="object-contain object-center p-4 sm:p-5"
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
      <div className="product-card-info w-full min-w-0 max-w-full [overflow-wrap:anywhere]">
        <p className="product-card-meta mt-5 max-w-full text-[10px] tracking-[.15em] text-[#6d2227] md:mt-7">
          {categoryName} / {product.producer ?? 'LINXAS'}
        </p>
        <h3 className="product-card-title mt-2 max-w-full text-[15px] font-normal md:mt-3">
          {product.name}
        </h3>
        <p className="product-card-price mt-4 max-w-full text-sm md:mt-5">
          {formatPrice(product.price)}{' '}
          <span className="text-[10px] text-stone-500">税込</span>
        </p>
      </div>
    </Link>
  );
}
