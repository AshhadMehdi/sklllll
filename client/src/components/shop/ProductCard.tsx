import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Stepper } from '@/components/ui';
import { useCart } from '@/stores/cart';
import type { Product } from '@/lib/types';
import { cn, money, vibrate } from '@/lib/utils';

export function ProductThumb({ product, className }: { product: Pick<Product, 'imageUrl' | 'emoji' | 'name'>; className?: string }) {
  return product.imageUrl ? (
    <img src={product.imageUrl} alt={product.name} className={cn('rounded-xl object-cover', className)} loading="lazy" />
  ) : (
    <div className={cn('grid place-items-center rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 text-3xl', className)}>{product.emoji || '🛍️'}</div>
  );
}

export function ProductCard({ product, shopName, disabled, layout = 'row' }: { product: Product; shopName: string; disabled?: boolean; layout?: 'row' | 'grid' }) {
  const qty = useCart((s) => s.items.find((i) => i.productId === product.id)?.quantity ?? 0);
  const add = useCart((s) => s.add);
  const setQty = useCart((s) => s.setQty);
  const out = !product.isAvailable || product.stock <= 0;
  const discount = product.compareAtPrice && product.compareAtPrice > product.price ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100) : 0;

  const onAdd = () => {
    if (disabled) return toast.error('This shop is closed right now');
    add(product, shopName);
    vibrate();
    toast.success(`Added ${product.name}`, { duration: 1200 });
  };

  if (layout === 'grid') {
    return (
      <div className={cn('card flex flex-col p-2.5', out && 'opacity-60')}>
        <div className="relative">
          <ProductThumb product={product} className="h-24 w-full" />
          {discount > 0 && <span className="absolute left-1.5 top-1.5 rounded-md bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white">-{discount}%</span>}
        </div>
        <div className="mt-2 flex-1">
          <div className="line-clamp-2 text-[13px] font-semibold leading-snug">{product.name}</div>
          <div className="text-[11px] text-slate-500">per {product.unit}</div>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <div>
            <div className="text-sm font-bold tabular">{money(product.price)}</div>
            {discount > 0 && <div className="text-[11px] text-slate-400 line-through">{money(product.compareAtPrice)}</div>}
          </div>
          {out ? <span className="text-[11px] font-semibold text-rose-600">Out of stock</span> : qty > 0 ? <Stepper size="sm" value={qty} max={Math.min(99, product.stock)} onChange={(v) => setQty(product.id, v)} /> : (
            <button onClick={onAdd} className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white shadow-sm active:scale-95"><Plus className="h-4 w-4" /></button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-3 py-3', out && 'opacity-60')}>
      <ProductThumb product={product} className="h-16 w-16 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-semibold">{product.name}</div>
            {product.description && <div className="line-clamp-1 text-xs text-slate-500">{product.description}</div>}
            <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
              <span>per {product.unit}</span>
              {product.stock > 0 && product.stock <= 5 && <span className="font-semibold text-amber-600">Only {product.stock} left</span>}
              {product.isFeatured && <span className="rounded bg-accent-50 px-1 text-[10px] font-bold text-accent-700">POPULAR</span>}
            </div>
          </div>
        </div>
        <div className="mt-1.5 flex items-center justify-between">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[15px] font-bold tabular">{money(product.price)}</span>
            {discount > 0 && (
              <>
                <span className="text-xs text-slate-400 line-through">{money(product.compareAtPrice)}</span>
                <span className="rounded bg-rose-50 px-1 text-[10px] font-bold text-rose-600">-{discount}%</span>
              </>
            )}
          </div>
          {out ? <span className="text-xs font-semibold text-rose-600">Out of stock</span> : qty > 0 ? <Stepper size="sm" value={qty} max={Math.min(99, product.stock)} onChange={(v) => setQty(product.id, v)} /> : (
            <button onClick={onAdd} className="inline-flex h-8 items-center gap-1 rounded-lg bg-brand-600 px-3 text-sm font-semibold text-white shadow-sm shadow-brand-600/30 active:scale-95">
              <Plus className="h-4 w-4" /> Add
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
