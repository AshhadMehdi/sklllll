import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Bike, Check, MessageCircle, Phone, Printer, X, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuth } from '@/stores/auth';
import { useOrderRoom, useSocketEvent } from '@/lib/socket';
import { OrderTrackingMap } from '@/components/map/OrderTrackingMap';
import { StatusBadge } from '@/components/order/StatusBadge';
import { OrderTimeline } from '@/components/order/OrderTimeline';
import { OrderItems, OrderTotals } from '@/components/order/OrderSummary';
import { ChatSheet } from '@/components/order/ChatSheet';
import { Sheet } from '@/components/ui/Sheet';
import { Dialog } from '@/components/ui/Dialog';
import { Avatar, Badge, Button, PageSpinner, Textarea } from '@/components/ui';
import { useConfig } from '@/hooks/useConfig';
import { PAYMENT_META, STATUS_META, VEHICLES } from '@/lib/constants';
import type { LatLng, Order, RunnerSummary } from '@/lib/types';
import { cn, fmtDate, km, money, telHref, timeAgo, waHref } from '@/lib/utils';

/** Shared by the merchant dashboard and the admin console (admin can act on any order). */
export default function MerchantOrderDetail() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const me = useAuth((s) => s.user);
  const isAdmin = me?.role === 'ADMIN';
  const base = isAdmin ? '/admin' : '/merchant';
  const { config } = useConfig();
  const [chat, setChat] = useState(false);
  const [assign, setAssign] = useState(params.get('assign') === '1');
  const [cancel, setCancel] = useState(false);
  const [reason, setReason] = useState('');
  const [runnerPos, setRunnerPos] = useState<LatLng | null>(null);

  const { data: order, isLoading } = useQuery({ queryKey: ['order', id], queryFn: () => api.orders.get(id) });
  useOrderRoom(id);
  useSocketEvent<Order>('order:updated', (o) => { if (o.id === id) qc.setQueryData(['order', id], o); }, [id]);
  useSocketEvent<{ orderId?: string; runnerId: string; lat: number; lng: number }>('runner:location', (p) => { if (p.orderId === id || (order?.runnerId && p.runnerId === order.runnerId)) setRunnerPos({ lat: p.lat, lng: p.lng }); }, [id, order?.runnerId]);
  useEffect(() => { if (params.get('assign')) setParams({}, { replace: true }); }, [params, setParams]);

  const done = () => { qc.invalidateQueries({ queryKey: ['merchant', 'orders'] }); qc.invalidateQueries({ queryKey: ['admin', 'orders'] }); qc.invalidateQueries({ queryKey: ['merchant', 'analytics'] }); };
  const status = useMutation({
    mutationFn: ({ status, reason }: { status: string; reason?: string }) => (isAdmin ? api.admin.setOrderStatus(id, status, reason) : api.merchant.setStatus(id, status, { reason })),
    onSuccess: (o) => { qc.setQueryData(['order', id], o); done(); toast.success(`${o.orderNumber} → ${STATUS_META[o.status].label}`); setCancel(false); },
    onError: (e) => toast.error((e as Error).message),
  });
  const assignM = useMutation({
    mutationFn: (runnerId: string | 'auto' | null) => (isAdmin ? api.admin.assign(id, runnerId) : api.merchant.assign(id, runnerId)),
    onSuccess: (o) => { qc.setQueryData(['order', id], o); done(); setAssign(false); toast.success(o.runner ? `${o.runner.name} assigned` : 'Rider unassigned'); },
    onError: (e) => toast.error((e as Error).message),
  });

  if (isLoading || !order) return <PageSpinner label="Loading order…" />;
  const live = !['DELIVERED', 'CANCELLED'].includes(order.status);
  const categoryEmoji = config.categories.find((c) => c.id === order.shop.category)?.emoji ?? '🏪';
  const next: { status: string; label: string; hint?: string; variant?: 'primary' | 'secondary' }[] =
    order.status === 'PENDING' ? [{ status: 'ACCEPTED', label: 'Accept order' }]
      : order.status === 'ACCEPTED' ? [{ status: 'PREPARING', label: 'Start preparing' }, { status: 'READY', label: 'Skip to ready', variant: 'secondary' }]
        : order.status === 'PREPARING' ? [{ status: 'READY', label: 'Mark ready for pickup' }]
          : order.status === 'READY' && !order.runner ? [{ status: 'ON_THE_WAY', label: 'Self-deliver: out for delivery', hint: 'No rider assigned — you deliver it yourself', variant: 'secondary' }]
            : order.status === 'ON_THE_WAY' && !order.runner ? [{ status: 'DELIVERED', label: 'Mark delivered' }]
              : [];

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button onClick={() => nav(`${base}/orders`)} className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-sm ring-1 ring-slate-100"><ArrowLeft className="h-5 w-5" /></button>
        <div className="min-w-0 flex-1">
          <h1 className="flex flex-wrap items-center gap-2 text-xl font-extrabold tracking-tight">{order.orderNumber} <StatusBadge status={order.status} size="md" /></h1>
          <p className="text-xs text-slate-500">Placed {fmtDate(order.createdAt)} · {timeAgo(order.createdAt)}{isAdmin && ` · ${order.shop.name}`}</p>
        </div>
        <button onClick={() => window.print()} className="hidden items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold md:inline-flex"><Printer className="h-4 w-4" /> Receipt</button>
        <Button variant="outline" leftIcon={<MessageCircle className="h-4 w-4" />} onClick={() => setChat(true)}>Chat</Button>
      </div>

      {order.status === 'PENDING' && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <span className="text-2xl">⏳</span>
          <div className="flex-1 text-sm text-amber-900"><b>Customer is waiting.</b> Accept to lock the stock and start the timer — estimated delivery ~{order.etaMinutes} min.</div>
          <Button leftIcon={<Check className="h-4 w-4" />} loading={status.isPending} onClick={() => status.mutate({ status: 'ACCEPTED' })}>Accept</Button>
          <Button variant="outline" className="text-rose-600" leftIcon={<X className="h-4 w-4" />} onClick={() => setCancel(true)}>Reject</Button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          {live && order.status !== 'PENDING' && (
            <section className="card p-4">
              <h2 className="mb-3 font-bold">Next step</h2>
              <div className="flex flex-wrap gap-2">
                {next.map((n) => <Button key={n.status} variant={n.variant ?? 'primary'} loading={status.isPending && status.variables?.status === n.status} onClick={() => status.mutate({ status: n.status })} title={n.hint}>{n.label}</Button>)}
                {['ACCEPTED', 'PREPARING', 'READY'].includes(order.status) && <Button variant={order.runner ? 'outline' : 'secondary'} leftIcon={<Bike className="h-4 w-4" />} onClick={() => setAssign(true)}>{order.runner ? 'Change rider' : 'Assign rider'}</Button>}
                <Button variant="ghost" className="text-rose-600" onClick={() => setCancel(true)}>Cancel order</Button>
              </div>
              {order.status === 'READY' && order.runner && <p className="mt-2 text-xs text-slate-500">Waiting for {order.runner.name} to pick up. They'll mark it on the way.</p>}
              {order.status === 'ON_THE_WAY' && order.runner && <p className="mt-2 text-xs text-slate-500">{order.runner.name} is delivering — they will mark it delivered.</p>}
            </section>
          )}

          <section className="card overflow-hidden">
            <div className="h-56"><OrderTrackingMap order={order} runnerPos={runnerPos} className="h-full" categoryEmoji={categoryEmoji} /></div>
            <div className="grid grid-cols-1 divide-y divide-slate-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
              <div className="p-4">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Customer</div>
                <div className="flex items-center gap-3">
                  <Avatar name={order.customer.name} src={order.customer.avatarUrl} />
                  <div className="min-w-0 flex-1"><div className="font-bold">{order.customer.name}</div><div className="text-xs text-slate-500">{order.customer.phone || order.deliveryAddress.phone || 'No phone'}</div></div>
                  {(order.customer.phone || order.deliveryAddress.phone) && <><a href={telHref(order.customer.phone || order.deliveryAddress.phone)} className="grid h-9 w-9 place-items-center rounded-full bg-brand-600 text-white"><Phone className="h-4 w-4" /></a><a href={waHref(order.customer.phone || order.deliveryAddress.phone, `Salam ${order.customer.name}, this is ${order.shop.name} about order ${order.orderNumber}`)} target="_blank" rel="noreferrer" className="grid h-9 w-9 place-items-center rounded-full bg-[#25D366] text-white text-sm font-bold">W</a></>}
                </div>
                <div className="mt-3 text-sm"><div className="font-medium">{order.deliveryAddress.label} · {km(order.distanceKm)} away</div><div className="text-slate-600">{[order.deliveryAddress.line1, order.deliveryAddress.area, order.deliveryAddress.city].filter(Boolean).join(', ')}</div>{order.deliveryAddress.instructions && <div className="mt-1 text-xs text-slate-500">“{order.deliveryAddress.instructions}”</div>}</div>
              </div>
              <div className="p-4">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Rider</div>
                {order.runner ? (
                  <div className="flex items-center gap-3">
                    <Avatar name={order.runner.name} src={order.runner.avatarUrl} />
                    <div className="min-w-0 flex-1"><div className="font-bold">{order.runner.name}</div><div className="text-xs text-slate-500">{VEHICLES[order.runner.vehicleType]?.emoji} {VEHICLES[order.runner.vehicleType]?.label} · ★ {order.runner.ratingAvg || 'New'}</div></div>
                    {order.runner.phone && <a href={telHref(order.runner.phone)} className="grid h-9 w-9 place-items-center rounded-full bg-slate-100"><Phone className="h-4 w-4" /></a>}
                  </div>
                ) : <div className="text-sm text-slate-500">{live ? 'No rider yet.' : '—'} {live && ['ACCEPTED', 'PREPARING', 'READY'].includes(order.status) && <button onClick={() => setAssign(true)} className="font-semibold text-brand-700">Assign now</button>}</div>}
                <div className="mt-3 text-sm"><div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Payment</div><div className="font-medium">{PAYMENT_META[order.paymentMethod].emoji} {PAYMENT_META[order.paymentMethod].label}</div><Badge tone={order.paymentStatus === 'PAID' ? 'brand' : order.paymentStatus === 'REFUNDED' ? 'slate' : 'amber'}>{order.paymentStatus === 'UNPAID' && order.paymentMethod === 'COD' ? `Collect ${money(order.total)} cash` : order.paymentStatus}</Badge></div>
              </div>
            </div>
          </section>

          <section className="card p-4">
            <h2 className="font-bold">Items</h2>
            <OrderItems order={order} />
            {order.notes && <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">📝 Customer note: {order.notes}</p>}
            <div className="mt-3 border-t border-slate-100 pt-3"><OrderTotals order={order} /></div>
          </section>
        </div>

        <div className="space-y-4">
          <section className="card p-4"><h2 className="mb-3 font-bold">Timeline</h2><OrderTimeline order={order} /></section>
          {order.review && <section className="card p-4"><h2 className="font-bold">Customer review</h2><div className="mt-1 text-amber-500">{'★'.repeat(order.review.shopRating)}{'☆'.repeat(5 - order.review.shopRating)}</div>{order.review.comment && <p className="mt-1 text-sm text-slate-600">“{order.review.comment}”</p>}</section>}
          {isAdmin && <section className="card p-4 text-sm"><h2 className="font-bold">Shop</h2><Link to={`/shop/${order.shopId}`} className="font-semibold text-brand-700">{order.shop.name}</Link><div className="text-slate-500">{order.shop.addressLine}</div></section>}
        </div>
      </div>

      <ChatSheet order={order} open={chat} onClose={() => setChat(false)} />
      <AssignSheet open={assign} onClose={() => setAssign(false)} order={order} isAdmin={isAdmin} onAssign={(r) => assignM.mutate(r)} busy={assignM.isPending} />
      <Dialog open={cancel} onClose={() => setCancel(false)} title={order.status === 'PENDING' ? 'Reject this order?' : 'Cancel this order?'} description="The customer is notified immediately and any online payment is refunded. Stock is returned to your inventory.">
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (shown to the customer) — e.g. items out of stock" />
        <div className="mt-4 flex gap-2"><Button variant="outline" block onClick={() => setCancel(false)}>Keep order</Button><Button variant="danger" block loading={status.isPending} onClick={() => status.mutate({ status: 'CANCELLED', reason: reason || (order.status === 'PENDING' ? 'Rejected by shop' : 'Cancelled by shop') })}>Confirm</Button></div>
      </Dialog>
    </div>
  );
}

function AssignSheet({ open, onClose, order, isAdmin, onAssign, busy }: { open: boolean; onClose: () => void; order: Order; isAdmin: boolean; onAssign: (r: string | 'auto' | null) => void; busy: boolean }) {
  const runners = useQuery({ queryKey: ['merchant', 'runners'], queryFn: api.merchant.runners, enabled: open && !isAdmin });
  const adminRunners = useQuery({ queryKey: ['admin', 'users', 'RUNNER'], queryFn: () => api.admin.users({ role: 'RUNNER' }), enabled: open && isAdmin });
  const list: RunnerSummary[] = isAdmin
    ? (adminRunners.data ?? []).map((u) => ({ id: u.id, name: u.name, phone: u.phone, email: u.email, avatarUrl: u.avatarUrl, vehicleType: 'bike', isAvailable: true, ratingAvg: 0, totalDeliveries: 0, lastSeenAt: null, distanceKm: null, activeDeliveries: 0, mine: false }))
    : [...(runners.data?.mine ?? []), ...(runners.data?.available ?? [])];
  return (
    <Sheet open={open} onClose={onClose} title="Assign a rider" size="tall">
      <button disabled={busy} onClick={() => onAssign('auto')} className="mb-3 flex w-full items-center gap-3 rounded-2xl bg-gradient-to-r from-brand-600 to-brand-700 p-4 text-left text-white shadow-card disabled:opacity-60">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/20"><Zap className="h-5 w-5" /></span>
        <span className="flex-1"><span className="block font-bold">Auto-assign nearest rider</span><span className="block text-xs text-white/80">Scores by distance to your shop and current workload</span></span>
      </button>
      {order.runner && <button disabled={busy} onClick={() => onAssign(null)} className="mb-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-rose-600">Unassign {order.runner.name}</button>}
      <div className="space-y-2 pb-4">
        {(runners.isLoading || adminRunners.isLoading) && <p className="text-sm text-slate-500">Loading riders…</p>}
        {list.length === 0 && !runners.isLoading && !adminRunners.isLoading && <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500">No riders online right now. Add your own riders under <b>Riders</b>, or self-deliver.</p>}
        {list.map((r) => (
          <button key={r.id} disabled={busy || r.id === order.runnerId} onClick={() => onAssign(r.id)} className={cn('flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition', r.id === order.runnerId ? 'border-brand-300 bg-brand-50' : 'border-slate-100 bg-white hover:border-brand-200')}>
            <Avatar name={r.name} src={r.avatarUrl} />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 font-semibold">{r.name}{r.mine && <Badge tone="brand">Your rider</Badge>}{!r.isAvailable && <Badge>Offline</Badge>}</span>
              <span className="block text-xs text-slate-500">{VEHICLES[r.vehicleType]?.emoji} {VEHICLES[r.vehicleType]?.label} · {r.distanceKm != null ? `${km(r.distanceKm)} away · ` : ''}{r.activeDeliveries} active · ★ {r.ratingAvg || 'New'}</span>
            </span>
            {r.id === order.runnerId ? <Check className="h-5 w-5 text-brand-600" /> : <span className="text-xs font-semibold text-brand-700">Assign</span>}
          </button>
        ))}
      </div>
    </Sheet>
  );
}
