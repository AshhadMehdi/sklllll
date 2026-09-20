import { Divider, Row } from '@/components/ui';
import { PAYMENT_META } from '@/lib/constants';
import type { Order } from '@/lib/types';
import { money } from '@/lib/utils';
import { ProductThumb } from '@/components/shop/ProductCard';

export function OrderItems({ order }: { order: Order }) {
  return (
    <ul className="divide-y divide-slate-100">
      {order.items.map((it) => (
        <li key={it.id} className="flex items-center gap-3 py-2.5">
          <ProductThumb product={{ imageUrl: it.imageUrl, emoji: it.emoji, name: it.name }} className="h-11 w-11 shrink-0 text-2xl" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{it.name}</div>
            <div className="text-xs text-slate-500">{it.quantity} × {money(it.unitPrice)} / {it.unit}{it.note ? ` · “${it.note}”` : ''}</div>
          </div>
          <div className="text-sm font-bold tabular">{money(it.total)}</div>
        </li>
      ))}
    </ul>
  );
}

export function OrderTotals({ order }: { order: Order }) {
  const pm = PAYMENT_META[order.paymentMethod];
  return (
    <div className="space-y-1.5">
      <Row label="Subtotal" value={money(order.subtotal)} />
      <Row label="Delivery fee" value={order.deliveryFee === 0 ? <span className="font-semibold text-brand-700">Free</span> : money(order.deliveryFee)} />
      <Row label="Service fee" value={money(order.serviceFee)} />
      {order.discount > 0 && <Row label={<span>Discount {order.promoCode && <span className="rounded bg-brand-50 px-1 text-[10px] font-bold text-brand-700">{order.promoCode}</span>}</span>} value={<span className="text-brand-700">−{money(order.discount)}</span>} />}
      {order.tip > 0 && <Row label="Rider tip" value={money(order.tip)} />}
      <Divider className="my-2" />
      <Row label="Total" value={money(order.total)} strong className="text-base" />
      <div className="flex items-center justify-between pt-1 text-xs text-slate-500">
        <span>{pm.emoji} {pm.label}</span>
        <span className={order.paymentStatus === 'PAID' ? 'font-semibold text-brand-700' : order.paymentStatus === 'REFUNDED' ? 'font-semibold text-rose-600' : ''}>{order.paymentStatus === 'PAID' ? 'Paid' : order.paymentStatus === 'REFUNDED' ? 'Refunded' : order.paymentMethod === 'COD' ? 'Pay on delivery' : 'Unpaid'}</span>
      </div>
    </div>
  );
}
