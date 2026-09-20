import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Product } from '@/lib/types';

export interface CartItem {
  productId: string;
  shopId: string;
  shopName: string;
  name: string;
  unit: string;
  price: number;
  emoji: string | null;
  imageUrl: string | null;
  quantity: number;
  note?: string;
  stock: number;
}

interface CartState {
  items: CartItem[];
  shopNotes: Record<string, string>;
  add: (product: Product, shopName: string, qty?: number) => void;
  setQty: (productId: string, qty: number) => void;
  remove: (productId: string) => void;
  setNote: (productId: string, note: string) => void;
  setShopNote: (shopId: string, note: string) => void;
  clearShop: (shopId: string) => void;
  clear: () => void;
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      shopNotes: {},
      add: (p, shopName, qty = 1) =>
        set((s) => {
          const existing = s.items.find((i) => i.productId === p.id);
          if (existing) return { items: s.items.map((i) => (i.productId === p.id ? { ...i, quantity: Math.min(i.quantity + qty, Math.max(1, p.stock)) } : i)) };
          return { items: [...s.items, { productId: p.id, shopId: p.shopId, shopName, name: p.name, unit: p.unit, price: p.price, emoji: p.emoji, imageUrl: p.imageUrl, quantity: qty, stock: p.stock }] };
        }),
      setQty: (productId, qty) => set((s) => ({ items: qty <= 0 ? s.items.filter((i) => i.productId !== productId) : s.items.map((i) => (i.productId === productId ? { ...i, quantity: Math.min(qty, 99) } : i)) })),
      remove: (productId) => set((s) => ({ items: s.items.filter((i) => i.productId !== productId) })),
      setNote: (productId, note) => set((s) => ({ items: s.items.map((i) => (i.productId === productId ? { ...i, note } : i)) })),
      setShopNote: (shopId, note) => set((s) => ({ shopNotes: { ...s.shopNotes, [shopId]: note } })),
      clearShop: (shopId) => set((s) => ({ items: s.items.filter((i) => i.shopId !== shopId) })),
      clear: () => set({ items: [], shopNotes: {} }),
    }),
    { name: 'qareeb.cart' },
  ),
);

export const selectCount = (s: CartState) => s.items.reduce((a, i) => a + i.quantity, 0);
export const selectSubtotal = (s: CartState) => s.items.reduce((a, i) => a + i.price * i.quantity, 0);
export const groupByShop = (items: CartItem[]) => {
  const map = new Map<string, { shopId: string; shopName: string; items: CartItem[]; subtotal: number }>();
  for (const it of items) {
    const g = map.get(it.shopId) ?? { shopId: it.shopId, shopName: it.shopName, items: [], subtotal: 0 };
    g.items.push(it);
    g.subtotal += it.price * it.quantity;
    map.set(it.shopId, g);
  }
  return [...map.values()];
};
