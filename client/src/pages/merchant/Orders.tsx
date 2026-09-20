import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { DashHeader } from '@/components/layout/PageHeader';
import { Tabs } from '@/components/ui/Tabs';
import { Button, EmptyState, Skeleton } from '@/components/ui';
import { StatusBadge } from '@/components/order/StatusBadge';
import { PAYMENT_META } from '@/lib/constants';
import type { Order } from '@/lib/types';
import { fmtTime, km, money, pluralize, timeAgo } from '@/lib/utils';

export default function MerchantOrders() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'new' | 'active' | 'past'>('new');
  const q = useQuery({ queryKey: ['merchant', 'orders', tab], queryFn: () => api.merchant.orders(tab), refetchInterval: tab === 'past' ? false : 20_000 });
  const newCount = useQuery({ queryKey: ['merchant', 'orders', 'new'], queryFn: () => api.merchant.orders('new') }).data?.length;
  const status = useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: string; reason?: string }) => api.merchant.setStatus(id, status, { reason }),
    onSuccess: (o) => { qc.invalidateQueries({ queryKey: ['merchant', 'orders'] }); qc.setQueryData(['order', o.id], o); toast.success(o.status === 'ACCEPTED' ? `Accepted ${o.orderNumber}` : `Updated ${o.orderNumber}`); },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div>
      <DashHeader title="Orders" subtitle="New orders ring the bell — accept them quickly to keep customers happy." />
      <Tabs className="max-w-md" tabs={[{ id: 'new', label: 'New', count: newCount }, { id: 'active', label: 'In progress' }, { id: 'past', label: 'History' }]} value={tab} onChange={setTab} />
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {q.isLoading && [1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-40" />)}
        {q.data?.length === 0 && <div className="lg:col-span-2"><EmptyState emoji={tab === 'new' ? '🔔' : '🧾'} title={tab === 'new' ? 'No new orders' : tab === 'active' ? 'Nothing in progress' : 'No past orders'} description={tab === 'new' ? 'New orders appear here instantly and play a sound.' : undefined} /></div>}
        {q.data?.map((o: Order) => (
          <div key={o.id} className="card p-4 transition hover:shadow-float">
            <button onClick={() => nav(`/merchant/orders/${o.id}`)} className="block w-full text-left">
              <div className="flex items-start justify-between gap-2">
                <div><div className="flex items-center gap-2 font-bold">{o.orderNumber}<StatusBadge status={o.status} /></div><div className="text-xs text-slate-500">{o.customer.name} · {timeAgo(o.createdAt)} · {fmtTime(o.createdAt)}</div></div>
                <div className="text-right"><div className="text-lg font-extrabold tabular">{money(o.total)}</div><div className="text-[11px] text-slate-500">{PAYMENT_META[o.paymentMethod].emoji} {PAYMENT_META[o.paymentMethod].label}{o.paymentStatus === 'PAID' ? ' · paid' : ''}</div></div>
              </div>
              <ul className="mt-3 space-y-1 text-sm">
                {o.items.slice(0, 4).map((it) => <li key={it.id} className="flex justify-between"><span><b className="tabular">{it.quantity}×</b> {it.emoji} {it.name}</span><span className="text-slate-500 tabular">{money(it.total)}</span></li>)}
                {o.items.length > 4 && <li className="text-xs text-slate-500">+{pluralize(o.items.length - 4, 'more item')}</li>}
              </ul>
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                <span>📍 {o.deliveryAddress.area || o.deliveryAddress.line1} · {km(o.distanceKm)}</span>
                {o.runner && <span>🛵 {o.runner.name}</span>}
                {o.notes && <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-amber-800">📝 {o.notes}</span>}
              </div>
            </button>
            {o.status === 'PENDING' && (
              <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                <Button leftIcon={<Check className="h-4 w-4" />} loading={status.isPending && status.variables?.id === o.id} onClick={() => status.mutate({ id: o.id, status: 'ACCEPTED' })}>Accept order</Button>
                <Button variant="outline" className="text-rose-600" leftIcon={<X className="h-4 w-4" />} onClick={() => { const reason = window.prompt('Reason for rejecting (shown to the customer):', 'Sorry, we are unable to fulfil this order right now'); if (reason !== null) status.mutate({ id: o.id, status: 'CANCELLED', reason: reason || 'Rejected by shop' }); }}>Reject</Button>
              </div>
            )}
            {o.status === 'ACCEPTED' && <Button className="mt-3" block variant="secondary" onClick={() => status.mutate({ id: o.id, status: 'PREPARING' })}>Start preparing</Button>}
            {o.status === 'PREPARING' && <Button className="mt-3" block variant="secondary" onClick={() => status.mutate({ id: o.id, status: 'READY' })}>Mark ready for pickup</Button>}
            {o.status === 'READY' && !o.runner && <Button className="mt-3" block variant="outline" onClick={() => nav(`/merchant/orders/${o.id}?assign=1`)}>Assign a rider</Button>}
          </div>
        ))}
      </div>
    </div>
  );
}
