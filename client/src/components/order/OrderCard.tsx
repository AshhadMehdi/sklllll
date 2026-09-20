import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { StatusBadge } from './StatusBadge';
import type { Order } from '@/lib/types';
import { fmtDate, money, pluralize } from '@/lib/utils';
import { ACTIVE_STATUSES } from '@/lib/constants';

export function OrderCard({ order, to, perspective = 'customer' }: { order: Order; to: string; perspective?: 'customer' | 'merchant' | 'runner' | 'admin' }) {
  const active = ACTIVE_STATUSES.includes(order.status);
  const title = perspective === 'customer' ? order.shop.name : order.customer.name;
  const subtitle = perspective === 'customer' ? order.deliveryAddress.label + ' · ' + (order.deliveryAddress.area || order.deliveryAddress.line1) : perspective === 'runner' ? `${order.shop.name} → ${order.deliveryAddress.area || order.deliveryAddress.line1}` : order.deliveryAddress.area || order.deliveryAddress.line1;
  return (
    <Link to={to} className="card block p-4 transition hover:shadow-float active:scale-[0.99]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-[15px] font-bold">{title}</span>
            <span className="shrink-0 text-xs text-slate-400">{order.orderNumber}</span>
          </div>
          <div className="truncate text-xs text-slate-500">{subtitle}</div>
        </div>
        <StatusBadge status={order.status} />
      </div>
      <div className="mt-3 flex items-center gap-2 overflow-hidden">
        <div className="flex -space-x-2">
          {order.items.slice(0, 4).map((it) => (
            <span key={it.id} className="grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-base ring-2 ring-white">{it.emoji || '🛍️'}</span>
          ))}
        </div>
        <span className="truncate text-xs text-slate-600">{order.items.map((i) => `${i.quantity}× ${i.name}`).join(', ')}</span>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
        <span>{pluralize(order.items.length, 'item')} · {fmtDate(order.createdAt)}</span>
        <span className="inline-flex items-center gap-1 text-sm font-bold text-ink tabular">
          {money(order.total)} <ChevronRight className="h-4 w-4 text-slate-400" />
        </span>
      </div>
      {active && order.status === 'ON_THE_WAY' && order.runner && (
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-orange-50 px-3 py-2 text-xs font-medium text-orange-800">
          🛵 {order.runner.name} is on the way · ETA ~{order.etaMinutes} min
        </div>
      )}
    </Link>
  );
}
