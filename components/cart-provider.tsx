'use client';
import Image from 'next/image';
import Link from 'next/link';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { formatPrice } from '@/lib/products';
import type { ProductCardItem } from './product-card';
export type CartProduct = ProductCardItem & { image: string };
type Line = { product: CartProduct; quantity: number };
type Cart = {
  items: Line[];
  add: (p: CartProduct, q?: number) => void;
  update: (id: string | number, q: number) => void;
  remove: (id: string | number) => void;
  clear: () => void;
  count: number;
  subtotal: number;
};
const C = createContext<Cart | undefined>(undefined);
export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Line[]>([]);
  const [notice, setNotice] = useState<CartProduct | null>(null);
  const [ready, setReady] = useState(false);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const raw = localStorage.getItem('kura-cart');
    if (raw) setItems(JSON.parse(raw));
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready) localStorage.setItem('kura-cart', JSON.stringify(items));
  }, [items, ready]);
  useEffect(
    () => () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    },
    [],
  );
  const value = useMemo(
    () => ({
      items,
      add: (product: CartProduct, quantity = 1) => {
        setItems((x) => {
          const item = x.find((v) => v.product.id === product.id);
          return item
            ? x.map((v) =>
                v.product.id === product.id
                  ? { ...v, quantity: v.quantity + quantity }
                  : v,
              )
            : [...x, { product, quantity }];
        });
        setNotice(product);
        if (noticeTimer.current) clearTimeout(noticeTimer.current);
        noticeTimer.current = setTimeout(() => setNotice(null), 3000);
      },
      update: (id: string | number, quantity: number) =>
        setItems((x) =>
          quantity < 1
            ? x.filter((v) => v.product.id !== id)
            : x.map((v) => (v.product.id === id ? { ...v, quantity } : v)),
        ),
      remove: (id: string | number) =>
        setItems((x) => x.filter((v) => v.product.id !== id)),
      clear: () => setItems([]),
      count: items.reduce((s, x) => s + x.quantity, 0),
      subtotal: items.reduce((s, x) => s + x.product.price * x.quantity, 0),
    }),
    [items],
  );
  return (
    <C.Provider value={value}>
      {children}
      {notice ? (
        <aside
          className="cart-toast"
          role="status"
          aria-live="polite"
          aria-label="カート追加のお知らせ"
        >
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="お知らせを閉じる"
            className="absolute right-4 top-3 text-xs text-stone-500"
          >
            ×
          </button>
          <p className="eyebrow">ADDED TO BAG</p>
          <div className="mt-4 grid grid-cols-[72px_1fr] gap-4">
            <div className="relative aspect-[4/5] overflow-hidden bg-stone-100">
              {notice.image ? (
                <Image
                  fill
                  sizes="72px"
                  className="object-cover"
                  src={notice.image}
                  alt=""
                />
              ) : null}
            </div>
            <div className="self-center">
              <p className="text-xs font-semibold">カートに追加しました</p>
              <p className="mt-2 text-sm">{notice.name}</p>
              <p className="mt-1 text-xs text-stone-500">
                {formatPrice(notice.price)}
              </p>
            </div>
          </div>
          <Link
            href="/cart"
            onClick={() => setNotice(null)}
            className="brand-link mt-5 inline-flex"
          >
            カートを見る <i aria-hidden="true">→</i>
          </Link>
        </aside>
      ) : null}
    </C.Provider>
  );
}
export const useCart = () => {
  const c = useContext(C);
  if (!c) throw Error('Cart unavailable');
  return c;
};
