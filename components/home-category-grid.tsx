'use client';

import Link from 'next/link';
import { useLanguage } from '@/components/language-provider';
import { categories } from '@/lib/products';

export function HomeCategoryGrid() {
  const { categoryLabel } = useLanguage();

  return (
    <section className="border-y line bg-[#faf8f4]">
      <div className="wrap py-20">
        <p className="eyebrow">Explore by category</p>
        <div className="mt-10 grid grid-cols-2 border-l line md:grid-cols-3">
          {categories.map((category, index) => (
            <Link
              key={category}
              href={`/products?category=${encodeURIComponent(category)}`}
              className="group border-b border-r line p-7 md:p-10"
            >
              <span className="text-xs text-stone-500">0{index + 1}</span>
              <p className="serif mt-10 text-2xl group-hover:text-[#6d2227]">
                {categoryLabel(category)}
              </p>
              <span className="mt-3 block text-xs text-[#6d2227]">
                選ぶ　→
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
