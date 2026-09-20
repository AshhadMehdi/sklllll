import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { DashHeader } from '@/components/layout/PageHeader';
import { StatusBadge } from '@/components/order/StatusBadge';
import { Chip, EmptyState, Skeleton } from '@/components/ui';
import { PAYMENT_META, STATUS_FLOW } from '@/lib/constants';
import type { OrderStatus } from '@/lib/types';
import { fmtDate, money } from '@/lib/utils';

export default function AdminOrders() {
  const [params, setParams] = useSearchParams();
  const status = (params.get('status') as OrderStatus | null) ?? null;
  const scope = params.get('scope') ?? 'all';
  const shop = params.get('shop');
  const q = useQuery({ queryKey: ['admin', 'orders', scope, status], queryFn: () => api.admin.orders({ scope, status: status ?? undefined }), refetchInterval: 30_000 });
  const list = useMemo(() => (q.data ?? []).filter((o) => !shop || o.shopId === shop), [q.data, shop]);
  const set = (patch: Record<string, string | null>) => { const next = new URLSearchParams(params); for (const [k, v] of Object.entries(patch)) v ? next.set(k, v) : next.delete(k); setParams(next); };
  return (
    <div>
      <DashHeader title="Orders" subtitle="Every order on the platform. Open one to intervene — reassign, cancel or force a status." />
      <div className="flex flex-wrap gap-2">
        <Chip active={scope === 'all' && !status} onClick={() => set({ scope: null, status: null })}>All</Chip>
        <Chip active={scope === 'active'} onClick={() => set({ scope: 'active', status: null })}>Active</Chip>
        {[...STATUS_FLOW, 'CANCELLED' as OrderStatus].map((s) => <Chip key={s} active={status === s} onClick={() => set({ status: s, scope: null })}>{s.replace(/_/g, ' ').toLowerCase()}</Chip>)}
        {shop && <Chip active onClick={() => set({ shop: null })}>Shop filter ✕</Chip>}
      </div>
      <div className="card mt-4 overflow-x-auto">
        {q.isLoading && <div className="space-y-2 p-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10" />)}</div>}
        {list.length === 0 && !q.isLoading && <EmptyState emoji="🧾" title="No orders match" />}
        {list.length > 0 && (
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-2">Order</th><th className="px-4 py-2">Shop</th><th className="px-4 py-2">Customer</th><th className="px-4 py-2">Rider</th><th className="px-4 py-2">Status</th><th className="px-4 py-2">Payment</th><th className="px-4 py-2 text-right">Total</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {list.map((o) => (
                <tr key={o.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2"><Link to={`/admin/orders/${o.id}`} className="font-semibold text-brand-700 hover:underline">{o.orderNumber}</Link><div className="text-[11px] text-slate-400">{fmtDate(o.createdAt)}</div></td>
                  <td className="px-4 py-2">{o.shop.name}</td>
                  <td className="px-4 py-2">{o.customer.name}<div className="text-[11px] text-slate-400">{o.deliveryAddress.area || o.deliveryAddress.line1}</div></td>
                  <td className="px-4 py-2">{o.runner?.name ?? <span className="text-slate-400">—</span>}</td>
                  <td className="px-4 py-2"><StatusBadge status={o.status} /></td>
                  <td className="px-4 py-2 text-xs">{PAYMENT_META[o.paymentMethod].emoji} {PAYMENT_META[o.paymentMethod].label}<div className="text-[11px] text-slate-400">{o.paymentStatus.toLowerCase()}</div></td>
                  <td className="px-4 py-2 text-right font-bold tabular">{money(o.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
