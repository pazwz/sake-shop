'use client';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
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
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const raw = localStorage.getItem('kura-cart');
    if (raw) setItems(JSON.parse(raw));
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready) localStorage.setItem('kura-cart', JSON.stringify(items));
  }, [items, ready]);
  const value = useMemo(
    () => ({
      items,
      add: (product: CartProduct, quantity = 1) =>
        setItems((x) => {
          const item = x.find((v) => v.product.id === product.id);
          return item
            ? x.map((v) =>
                v.product.id === product.id
                  ? { ...v, quantity: v.quantity + quantity }
                  : v,
              )
            : [...x, { product, quantity }];
        }),
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
  return <C.Provider value={value}>{children}</C.Provider>;
}
export const useCart = () => {
  const c = useContext(C);
  if (!c) throw Error('Cart unavailable');
  return c;
};
