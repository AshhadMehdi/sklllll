import { useEffect, useState } from 'react';
import { Link, useLocation as useRoute, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageCircle, Phone, RotateCcw, Star, Store } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useOrderRoom, useSocketEvent } from '@/lib/socket';
import { useCart } from '@/stores/cart';
import { PageHeader } from '@/components/layout/PageHeader';
import { OrderTrackingMap } from '@/components/map/OrderTrackingMap';
import { StatusBadge } from '@/components/order/StatusBadge';
import { OrderTimeline } from '@/components/order/OrderTimeline';
import { OrderItems, OrderTotals } from '@/components/order/OrderSummary';
import { ChatSheet } from '@/components/order/ChatSheet';
import { ReviewSheet } from '@/components/order/ReviewSheet';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { Avatar, Button, PageSpinner, StarRating } from '@/components/ui';
import { useConfig } from '@/hooks/useConfig';
import { STATUS_META, VEHICLES } from '@/lib/constants';
import type { LatLng, Order } from '@/lib/types';
import { fmtDate, telHref, waHref } from '@/lib/utils';

export default function OrderDetail() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const route = useRoute() as { state?: { placed?: boolean; count?: number } };
  const qc = useQueryClient();
  const { config } = useConfig();
  const [chat, setChat] = useState(false);
  const [review, setReview] = useState(false);
  const [cancel, setCancel] = useState(false);
  const [runnerPos, setRunnerPos] = useState<LatLng | null>(null);
  const addToCart = useCart((s) => s.add);

  const { data: order, isLoading } = useQuery({ queryKey: ['order', id], queryFn: () => api.orders.get(id), refetchInterval: (q) => (q.state.data && ['DELIVERED', 'CANCELLED'].includes(q.state.data.status) ? false : 30_000) });
  useOrderRoom(id);
  useSocketEvent<Order>('order:updated', (o) => { if (o.id === id) qc.setQueryData(['order', id], o); }, [id]);
  useSocketEvent<{ orderId?: string; runnerId: string; lat: number; lng: number }>('runner:location', (p) => { if (p.orderId === id || (order?.runnerId && p.runnerId === order.runnerId)) setRunnerPos({ lat: p.lat, lng: p.lng }); }, [id, order?.runnerId]);

  useEffect(() => {
    if (route.state?.placed) toast.success(route.state.count && route.state.count > 1 ? `${route.state.count} orders sent to the shops. Track each one from My orders.` : 'Order sent to the shop!');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cancelM = useMutation({ mutationFn: (reason: string) => api.orders.cancel(id, reason), onSuccess: (o) => { qc.setQueryData(['order', id], o); qc.invalidateQueries({ queryKey: ['orders'] }); toast.success('Order cancelled'); }, onError: (e) => toast.error((e as Error).message) });

  if (isLoading || !order) return <PageSpinner label="Loading order…" />;
  const meta = STATUS_META[order.status];
  const live = !['DELIVERED', 'CANCELLED'].includes(order.status);
  const acceptedAgoMin = order.acceptedAt ? (Date.now() - new Date(order.acceptedAt).getTime()) / 60000 : 0;
  const canCancel = order.status === 'PENDING' || (order.status === 'ACCEPTED' && acceptedAgoMin <= config.customerCancelWindowMin);
  const categoryEmoji = config.categories.find((c) => c.id === order.shop.category)?.emoji ?? '🏪';

  const reorder = async () => {
    try {
      const shop = await api.shops.get(order.shopId);
      let added = 0;
      for (const it of order.items) {
        const p = shop.products.find((x) => x.id === it.productId);
        if (p && p.isAvailable && p.stock > 0) { addToCart(p, shop.name, it.quantity); added++; }
      }
      toast.success(added ? `Added ${added} items to your cart` : 'Those items are no longer available');
      if (added) nav('/cart');
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div className="min-h-dvh pb-10">
      <PageHeader title={<span className="flex items-center gap-2">{order.orderNumber}<StatusBadge status={order.status} /></span>} subtitle={`${order.shop.name} · ${fmtDate(order.createdAt)}`} back="/orders" />

      {live && (
        <div className="relative h-64">
          <OrderTrackingMap order={order} runnerPos={runnerPos} className="h-full" categoryEmoji={categoryEmoji} />
          <motion.div key={order.status} initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="absolute inset-x-4 bottom-3 z-[400] flex items-center gap-3 rounded-2xl bg-white/95 p-3 shadow-float backdrop-blur">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-2xl">{meta.emoji}</span>
            <div className="min-w-0 flex-1">
              <div className="font-bold">{meta.label}</div>
              <div className="truncate text-xs text-slate-500">{order.status === 'ON_THE_WAY' && order.runner ? `${order.runner.name} is heading to you` : meta.description}</div>
            </div>
            <div className="text-right"><div className="text-lg font-extrabold leading-none tabular">~{order.etaMinutes}</div><div className="text-[10px] text-slate-500">min</div></div>
          </motion.div>
        </div>
      )}

      <div className="space-y-4 px-4 pt-4">
        {order.runner && live && (
          <section className="card flex items-center gap-3 p-4">
            <Avatar name={order.runner.name} src={order.runner.avatarUrl} size="lg" />
            <div className="min-w-0 flex-1">
              <div className="font-bold">{order.runner.name}</div>
              <div className="text-xs text-slate-500">{VEHICLES[order.runner.vehicleType]?.emoji} {VEHICLES[order.runner.vehicleType]?.label} · <Star className="inline h-3 w-3 fill-amber-400 text-amber-400" /> {order.runner.ratingAvg || 'New'}</div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setChat(true)} className="grid h-10 w-10 place-items-center rounded-full bg-brand-50 text-brand-700"><MessageCircle className="h-5 w-5" /></button>
              {order.runner.phone && <a href={telHref(order.runner.phone)} className="grid h-10 w-10 place-items-center rounded-full bg-brand-600 text-white"><Phone className="h-5 w-5" /></a>}
            </div>
          </section>
        )}

        {order.status === 'DELIVERED' && !order.review && (
          <section className="rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 p-4 text-white">
            <div className="font-bold">How was it? 🎉</div>
            <p className="text-sm text-white/80">Rate {order.shop.name}{order.runner ? ` and ${order.runner.name}` : ''} to help your neighbours.{order.pointsEarned ? ` You earned ${order.pointsEarned} points.` : ''}</p>
            <Button variant="dark" className="mt-3 bg-white text-brand-800 hover:bg-brand-50" onClick={() => setReview(true)}>Leave a review</Button>
          </section>
        )}
        {order.review && (
          <section className="card p-4">
            <div className="flex items-center justify-between"><span className="font-bold">Your review</span><StarRating value={order.review.shopRating} size="sm" /></div>
            {order.review.comment && <p className="mt-1 text-sm text-slate-600">“{order.review.comment}”</p>}
          </section>
        )}

        <section className="card p-4">
          <h2 className="mb-3 font-bold">Order status</h2>
          <OrderTimeline order={order} />
        </section>

        <section className="card p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">Items from {order.shop.name}</h2>
            <Link to={`/shop/${order.shopId}`} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700"><Store className="h-3.5 w-3.5" /> Shop</Link>
          </div>
          <OrderItems order={order} />
          {order.notes && <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">📝 {order.notes}</p>}
          <div className="mt-3 border-t border-slate-100 pt-3"><OrderTotals order={order} /></div>
        </section>

        <section className="card p-4 text-sm">
          <h2 className="mb-1 font-bold">Delivery address</h2>
          <div className="font-medium">{order.deliveryAddress.label}</div>
          <div className="text-slate-600">{[order.deliveryAddress.line1, order.deliveryAddress.area, order.deliveryAddress.city].filter(Boolean).join(', ')}</div>
          {order.deliveryAddress.instructions && <div className="mt-1 text-xs text-slate-500">“{order.deliveryAddress.instructions}”</div>}
        </section>

        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" leftIcon={<MessageCircle className="h-4 w-4" />} onClick={() => setChat(true)}>Chat</Button>
          {order.shop.phone && <a href={waHref(order.shop.phone, `Salam! About my order ${order.orderNumber}`)} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-[15px] font-semibold"><Phone className="h-4 w-4" /> Call shop</a>}
          {!live && <Button variant="secondary" leftIcon={<RotateCcw className="h-4 w-4" />} onClick={reorder} className="col-span-2">Reorder these items</Button>}
          {live && canCancel && <Button variant="ghost" className="col-span-2 text-rose-600 hover:bg-rose-50" onClick={() => setCancel(true)}>Cancel order</Button>}
          {live && !canCancel && <p className="col-span-2 text-center text-xs text-slate-500">The shop has started preparing your order, so it can't be cancelled from the app. Contact the shop if needed.</p>}
        </div>
      </div>

      <ChatSheet order={order} open={chat} onClose={() => setChat(false)} />
      <ReviewSheet order={order} open={review} onClose={() => setReview(false)} />
      <ConfirmDialog open={cancel} onClose={() => setCancel(false)} title="Cancel this order?" description="The shop will be notified and any online payment will be refunded to you." confirmLabel="Yes, cancel" danger onConfirm={() => cancelM.mutateAsync('Cancelled by customer').then(() => undefined)} />
    </div>
  );
}
