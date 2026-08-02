"use client";
import Image from "next/image";
import Link from "next/link";
import { Fragment, Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { categories, products } from "@/lib/products";
import { ProductCard } from "@/components/product-card";
const seasonMap: Record<string, string> = {
  spring: "春",
  summer: "夏",
  autumn: "秋",
  winter: "冬",
};
export default function ProductsPage() {
  return (
    <Suspense fallback={null}>
      <Collection />
    </Suspense>
  );
}
function Collection() {
  const params = useSearchParams();
  const initialSeason =
    seasonMap[params.get("season") || ""] || params.get("season") || "すべて";
  const [category, setCategory] = useState(params.get("category") || "すべて");
  const [subcategory, setSubcategory] = useState(
    params.get("subcategory") || "すべて",
  );
  const [taste, setTaste] = useState(params.get("taste") || "すべて");
  const [origin, setOrigin] = useState(params.get("origin") || "すべて");
  const [season, setSeason] = useState(initialSeason);
  const [query, setQuery] = useState(params.get("q") || "");
  const [min, setMin] = useState(0);
  const [max, setMax] = useState(30000);
  const source =
    category === "すべて"
      ? products
      : products.filter((item) => item.category === category);
  const list = useMemo(
    () =>
      source.filter((item) => {
        const words =
          `${item.name} ${item.subtitle} ${item.producer} ${item.origin} ${item.category}`.toLowerCase();
        return (
          (subcategory === "すべて" || item.subcategory === subcategory) &&
          (taste === "すべて" || item.tasteProfile === taste) &&
          (origin === "すべて" || item.origin === origin) &&
          (season === "すべて" || item.seasonTags.includes(season)) &&
          item.price >= min &&
          item.price <= max &&
          words.includes(query.toLowerCase())
        );
      }),
    [source, subcategory, taste, origin, season, min, max, query],
  );
  const values = (field: "subcategory" | "tasteProfile" | "origin") => [
    ...new Set(source.map((item) => item[field])),
  ];
  return (
    <div className="wrap py-14 md:py-20">
      <p className="eyebrow">THE COLLECTION</p>
      <h1 className="serif mt-4 text-5xl">酒を選ぶ。</h1>
      <div className="mt-12 grid gap-x-7 gap-y-6 border-y line py-7 md:grid-cols-2 xl:grid-cols-4">
        <Label text="キーワード検索">
          <input
            className="input mt-1"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="商品名・蔵元・産地"
          />
        </Label>
        <Label text="カテゴリー">
          <Picker
            value={category}
            change={(value) => {
              setCategory(value);
              setSubcategory("すべて");
              setTaste("すべて");
              setOrigin("すべて");
            }}
            values={["すべて", ...categories]}
          />
        </Label>
        <Label text="種類">
          <Picker
            value={subcategory}
            change={setSubcategory}
            values={["すべて", ...values("subcategory")]}
          />
        </Label>
        <Label text="味わい">
          <Picker
            value={taste}
            change={setTaste}
            values={["すべて", ...values("tasteProfile")]}
          />
        </Label>
        <Label text="産地">
          <Picker
            value={origin}
            change={setOrigin}
            values={["すべて", ...values("origin")]}
          />
        </Label>
        <Label text="季節">
          <Picker
            value={season}
            change={setSeason}
            values={["すべて", "春", "夏", "秋", "冬"]}
          />
        </Label>
        <Label text="価格帯">
          <div className="flex items-center gap-2">
            <input
              className="input"
              type="number"
              value={min}
              onChange={(e) => setMin(Math.min(+e.target.value, max))}
            />
            <span>—</span>
            <input
              className="input"
              type="number"
              value={max}
              onChange={(e) => setMax(Math.max(+e.target.value, min))}
            />
          </div>
        </Label>
      </div>
      <p className="mt-8 text-xs text-stone-500">{list.length} ITEMS</p>
      <div className="mt-8 grid gap-x-5 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((item, index) => (
          <Fragment key={`product-${item.id}`}>
            <ProductCard product={item} />
            {index === 2 && <Editorial key="editorial-summer-feature" />}
          </Fragment>
        ))}
      </div>
      {!list.length && (
        <p className="py-20 text-center text-sm text-stone-500">
          条件に一致する商品が見つかりません。
        </p>
      )}
    </div>
  );
}
function Label({
  text,
  children,
}: {
  text: string;
  children: React.ReactNode;
}) {
  return (
    <label className="text-xs">
      {text}
      {children}
    </label>
  );
}
function Picker({
  value,
  change,
  values,
}: {
  value: string;
  change: (value: string) => void;
  values: string[];
}) {
  return (
    <select
      className="input mt-1 block"
      value={value}
      onChange={(e) => change(e.target.value)}
    >
      {values.map((value) => (
        <option key={value}>{value}</option>
      ))}
    </select>
  );
}
function Editorial() {
  return (
    <Link
      href="/products?season=summer"
      className="group relative min-h-[380px] overflow-hidden text-white"
    >
      <Image
        fill
        className="object-cover"
        src="https://images.unsplash.com/photo-1569529465841-dfecdab7503b?auto=format&fit=crop&w=900&q=80"
        alt="夏の特集"
      />
      <div className="absolute inset-0 bg-black/40" />
      <div className="absolute bottom-8 left-7">
        <p className="eyebrow text-[#e1c88f]">EDITOR&apos;S PICK</p>
        <h2 className="serif mt-3 text-3xl">夏の特集</h2>
        <p className="mt-3 text-sm">涼やかな日本酒を集めました。</p>
        <span className="mt-4 block text-xs text-[#e1c88f]">特集を見る　→</span>
      </div>
    </Link>
  );
}
