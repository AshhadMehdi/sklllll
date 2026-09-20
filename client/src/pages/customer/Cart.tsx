import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Store, Trash2 } from 'lucide-react';
import { groupByShop, selectCount, selectSubtotal, useCart } from '@/stores/cart';
import { useAuth } from '@/stores/auth';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, EmptyState, Stepper, Textarea } from '@/components/ui';
import { ProductThumb } from '@/components/shop/ProductCard';
import { money, pluralize } from '@/lib/utils';

export default function Cart() {
  const nav = useNavigate();
  const token = useAuth((s) => s.token);
  const { items, shopNotes, setQty, remove, clearShop, setShopNote, clear } = useCart();
  const count = useCart(selectCount);
  const subtotal = useCart(selectSubtotal);
  const groups = groupByShop(items);

  if (items.length === 0) {
    return (
      <div>
        <PageHeader title="Your cart" back={false} />
        <EmptyState emoji="🛒" title="Your cart is empty" description="Add items from one or more shops — you can check out from several shops in one go." action={<Button onClick={() => nav('/home')}>Browse shops</Button>} />
      </div>
    );
  }

  return (
    <div className="min-h-dvh pb-40">
      <PageHeader title="Your cart" subtitle={`${pluralize(count, 'item')} from ${pluralize(groups.length, 'shop')}`} back={false} action={<button onClick={clear} className="text-xs font-semibold text-rose-600">Clear all</button>} />
      <div className="space-y-4 px-4 pt-4">
        {groups.map((g) => (
          <section key={g.shopId} className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <Link to={`/shop/${g.shopId}`} className="flex items-center gap-2 font-bold"><Store className="h-4 w-4 text-brand-700" />{g.shopName}</Link>
              <button onClick={() => clearShop(g.shopId)} className="text-xs font-semibold text-slate-400 hover:text-rose-600">Remove shop</button>
            </div>
            <ul className="divide-y divide-slate-100 px-4">
              {g.items.map((it) => (
                <li key={it.productId} className="flex items-center gap-3 py-3">
                  <ProductThumb product={it} className="h-14 w-14 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{it.name}</div>
                    <div className="text-xs text-slate-500">{money(it.price)} / {it.unit}</div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <Stepper size="sm" value={it.quantity} max={Math.min(99, it.stock || 99)} onChange={(v) => setQty(it.productId, v)} />
                      <button onClick={() => remove(it.productId)} className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                  <div className="text-sm font-bold tabular">{money(it.price * it.quantity)}</div>
                </li>
              ))}
            </ul>
            <div className="border-t border-slate-100 px-4 py-3">
              <Textarea value={shopNotes[g.shopId] ?? ''} onChange={(e) => setShopNote(g.shopId, e.target.value)} placeholder={`Note for ${g.shopName} (e.g. “ripe bananas please”)`} className="min-h-[56px] text-sm" maxLength={300} />
              <div className="mt-2 flex justify-between text-sm"><span className="text-slate-500">Shop subtotal</span><span className="font-bold tabular">{money(g.subtotal)}</span></div>
            </div>
          </section>
        ))}
        <p className="text-center text-xs text-slate-500">Delivery fees, discounts and ETA are calculated at checkout for each shop.</p>
      </div>
      <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 mx-auto max-w-md px-4">
        <div className="card flex items-center justify-between gap-3 p-3 shadow-float">
          <div>
            <div className="text-xs text-slate-500">Subtotal</div>
            <div className="text-lg font-extrabold tabular">{money(subtotal)}</div>
          </div>
          <Button size="lg" className="flex-1" rightIcon={<ArrowRight className="h-4 w-4" />} onClick={() => (token ? nav('/checkout') : nav('/login', { state: { from: '/checkout' } }))}>
            {token ? 'Checkout' : 'Sign in to checkout'}
          </Button>
        </div>
      </div>
    </div>
  );
}
