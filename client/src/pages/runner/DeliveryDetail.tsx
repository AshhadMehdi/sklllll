import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, MessageCircle, Navigation, Phone, PlayCircle, Square } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useOrderRoom, useSocketEvent } from '@/lib/socket';
import { simulateRide, useRunnerPosition } from '@/hooks/useRunnerGps';
import { OrderTrackingMap } from '@/components/map/OrderTrackingMap';
import { StatusBadge } from '@/components/order/StatusBadge';
import { OrderTimeline } from '@/components/order/OrderTimeline';
import { OrderItems } from '@/components/order/OrderSummary';
import { ChatSheet } from '@/components/order/ChatSheet';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { Avatar, Button, PageSpinner } from '@/components/ui';
import { useConfig } from '@/hooks/useConfig';
import { PAYMENT_META } from '@/lib/constants';
import type { Order } from '@/lib/types';
import { cn, km, mapsHref, money, telHref, vibrate, waHref } from '@/lib/utils';
import { haversineKm } from '@/lib/geo';

export default function DeliveryDetail() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { config } = useConfig();
  const [chat, setChat] = useState(false);
  const [confirmDeliver, setConfirmDeliver] = useState(false);
  const [confirmDecline, setConfirmDecline] = useState(false);
  const { pos, simulated } = useRunnerPosition();
  const stopSim = useRef<(() => void) | null>(null);

  const { data: order, isLoading } = useQuery({ queryKey: ['order', id], queryFn: () => api.runner.delivery(id) });
  useOrderRoom(id);
  useSocketEvent<Order>('order:updated', (o) => { if (o.id === id) qc.setQueryData(['order', id], o); }, [id]);
  useEffect(() => () => stopSim.current?.(), []);

  const done = () => { qc.invalidateQueries({ queryKey: ['runner'] }); };
  const status = useMutation({
    mutationFn: (s: 'ON_THE_WAY' | 'DELIVERED') => api.runner.setStatus(id, s),
    onSuccess: (o) => { qc.setQueryData(['order', id], o); done(); vibrate([20, 30, 20]); toast.success(o.status === 'DELIVERED' ? `Delivered! You earned ${money(o.deliveryFee + o.tip)} 🎉` : 'Marked as picked up — customer can see you live'); setConfirmDeliver(false); },
    onError: (e) => toast.error((e as Error).message),
  });
  const decline = useMutation({
    mutationFn: () => api.runner.decline(id, 'Rider unavailable'),
    onSuccess: () => { done(); toast('Delivery declined — the shop will reassign it'); nav('/runner'); },
    onError: (e) => toast.error((e as Error).message),
  });

  if (isLoading || !order) return <PageSpinner label="Loading delivery…" />;
  const live = !['DELIVERED', 'CANCELLED'].includes(order.status);
  const categoryEmoji = config.categories.find((c) => c.id === order.shop.category)?.emoji ?? '🏪';
  const shopPt = { lat: order.shop.lat, lng: order.shop.lng };
  const homePt = { lat: order.deliveryAddress.lat, lng: order.deliveryAddress.lng };
  const target = order.status === 'ON_THE_WAY' ? homePt : shopPt;
  const distToTarget = pos ? haversineKm(pos, target) : null;
  const cod = order.paymentMethod === 'COD' && order.paymentStatus !== 'PAID';

  const startSim = () => {
    stopSim.current?.();
    const from = order.status === 'ON_THE_WAY' ? (pos ?? shopPt) : shopPt;
    stopSim.current = simulateRide(from, order.status === 'ON_THE_WAY' ? homePt : shopPt, order.status === 'ON_THE_WAY' ? 60_000 : 20_000, () => toast.success(order.status === 'ON_THE_WAY' ? 'Arrived at the customer (simulated)' : 'Arrived at the shop (simulated)'));
    toast('Simulating the ride — customers watching this order will see you move');
  };

  return (
    <div className="mx-auto max-w-3xl pb-28 md:pb-0">
      <div className="mb-3 flex items-center gap-3">
        <button onClick={() => nav('/runner')} className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-sm ring-1 ring-slate-100"><ArrowLeft className="h-5 w-5" /></button>
        <div className="min-w-0 flex-1"><h1 className="flex items-center gap-2 text-xl font-extrabold">{order.orderNumber} <StatusBadge status={order.status} /></h1><p className="text-xs text-slate-500">{order.shop.name} → {order.deliveryAddress.area || order.deliveryAddress.line1}</p></div>
        <div className="text-right"><div className="text-lg font-extrabold text-brand-700 tabular">+{money(order.deliveryFee + order.tip)}</div><div className="text-[10px] text-slate-500">your earnings</div></div>
      </div>

      <section className="card overflow-hidden">
        <div className="relative h-64 sm:h-80">
          <OrderTrackingMap order={order} runnerPos={pos} className="h-full" categoryEmoji={categoryEmoji} />
          {live && (
            <div className="absolute inset-x-3 top-3 z-[400] flex items-center gap-2 rounded-2xl bg-white/95 p-3 shadow-float backdrop-blur">
              <span className="text-2xl">{order.status === 'ON_THE_WAY' ? '🏠' : '🏪'}</span>
              <div className="min-w-0 flex-1"><div className="text-sm font-bold">{order.status === 'ON_THE_WAY' ? `Deliver to ${order.customer.name}` : `Pick up from ${order.shop.name}`}</div><div className="truncate text-xs text-slate-500">{distToTarget != null ? `${km(distToTarget)} away · ` : ''}{order.status === 'ON_THE_WAY' ? [order.deliveryAddress.line1, order.deliveryAddress.area].filter(Boolean).join(', ') : order.shop.addressLine}</div></div>
              <a href={mapsHref(target.lat, target.lng)} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-1 rounded-xl bg-ink px-3 text-sm font-semibold text-white"><Navigation className="h-4 w-4" /> Navigate</a>
            </div>
          )}
        </div>
        {config.demo && live && (
          <div className="flex items-center justify-between gap-2 border-t border-dashed border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-600">
            <span>🧪 Demo: no GPS on this device? Fake the ride to see live tracking.</span>
            {simulated ? <Button size="sm" variant="outline" leftIcon={<Square className="h-3.5 w-3.5" />} onClick={() => { stopSim.current?.(); stopSim.current = null; }}>Stop</Button> : <Button size="sm" variant="secondary" leftIcon={<PlayCircle className="h-3.5 w-3.5" />} onClick={startSim}>Simulate ride</Button>}
          </div>
        )}
      </section>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <section className="card p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Pickup</div>
          <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-2xl">{categoryEmoji}</span><div className="min-w-0 flex-1"><div className="font-bold">{order.shop.name}</div><div className="truncate text-xs text-slate-500">{order.shop.addressLine}</div></div>{order.shop.phone && <a href={telHref(order.shop.phone)} className="grid h-10 w-10 place-items-center rounded-full bg-slate-100"><Phone className="h-4 w-4" /></a>}</div>
        </section>
        <section className="card p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Drop-off</div>
          <div className="flex items-center gap-3"><Avatar name={order.customer.name} src={order.customer.avatarUrl} size="lg" /><div className="min-w-0 flex-1"><div className="font-bold">{order.customer.name}</div><div className="truncate text-xs text-slate-500">{[order.deliveryAddress.line1, order.deliveryAddress.area, order.deliveryAddress.city].filter(Boolean).join(', ')}</div></div>
            <div className="flex gap-1.5"><button onClick={() => setChat(true)} className="grid h-10 w-10 place-items-center rounded-full bg-brand-50 text-brand-700"><MessageCircle className="h-4 w-4" /></button>{(order.customer.phone || order.deliveryAddress.phone) && <><a href={telHref(order.customer.phone || order.deliveryAddress.phone)} className="grid h-10 w-10 place-items-center rounded-full bg-brand-600 text-white"><Phone className="h-4 w-4" /></a><a href={waHref(order.customer.phone || order.deliveryAddress.phone, `Salam! I'm your Qareeb rider for order ${order.orderNumber}.`)} target="_blank" rel="noreferrer" className="grid h-10 w-10 place-items-center rounded-full bg-[#25D366] text-sm font-bold text-white">W</a></>}</div>
          </div>
          {order.deliveryAddress.instructions && <div className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">📝 {order.deliveryAddress.instructions}</div>}
        </section>
      </div>

      <section className={cn('mt-4 rounded-2xl p-4', cod ? 'bg-amber-50 ring-1 ring-amber-200' : 'card')}>
        <div className="flex items-center justify-between"><div><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Payment</div><div className="font-bold">{PAYMENT_META[order.paymentMethod].emoji} {PAYMENT_META[order.paymentMethod].label}</div></div><div className="text-right"><div className="text-2xl font-extrabold tabular">{cod ? money(order.total) : '✓'}</div><div className="text-xs text-slate-500">{cod ? 'collect from customer' : order.paymentStatus === 'PAID' ? 'already paid' : order.paymentStatus.toLowerCase()}</div></div></div>
      </section>

      <section className="card mt-4 p-4"><h2 className="font-bold">Items to carry ({order.items.reduce((a, i) => a + i.quantity, 0)})</h2><OrderItems order={order} /></section>
      <section className="card mt-4 p-4"><h2 className="mb-3 font-bold">Timeline</h2><OrderTimeline order={order} /></section>

      {live && (
        <div className="fixed inset-x-0 bottom-[64px] z-30 border-t border-slate-100 bg-white/95 p-3 backdrop-blur md:static md:mt-4 md:rounded-2xl md:border md:p-4">
          <div className="mx-auto flex max-w-3xl gap-2">
            {order.status === 'READY' && <Button size="lg" block loading={status.isPending} onClick={() => status.mutate('ON_THE_WAY')}>I've picked it up 📦</Button>}
            {['ACCEPTED', 'PREPARING'].includes(order.status) && <Button size="lg" block variant="secondary" disabled>Waiting for the shop to pack…</Button>}
            {order.status === 'ON_THE_WAY' && <Button size="lg" block onClick={() => setConfirmDeliver(true)}>Mark as delivered ✅</Button>}
            {order.status !== 'ON_THE_WAY' && <Button size="lg" variant="outline" className="text-rose-600" onClick={() => setConfirmDecline(true)}>Decline</Button>}
          </div>
        </div>
      )}

      <ChatSheet order={order} open={chat} onClose={() => setChat(false)} />
      <ConfirmDialog open={confirmDeliver} onClose={() => setConfirmDeliver(false)} title="Confirm delivery" description={cod ? `Did you collect ${money(order.total)} in cash from ${order.customer.name}?` : `Hand over the order to ${order.customer.name} and confirm.`} confirmLabel="Yes, delivered" onConfirm={() => status.mutateAsync('DELIVERED').then(() => undefined)} />
      <ConfirmDialog open={confirmDecline} onClose={() => setConfirmDecline(false)} title="Decline this delivery?" description="The shop will be asked to assign another rider. Declining often lowers your priority for auto-assignment." confirmLabel="Decline" danger onConfirm={() => decline.mutateAsync().then(() => undefined)} />
    </div>
  );
}
