import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Marker } from 'react-leaflet';
import { MapPin, Navigation } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useRunnerPosition } from '@/hooks/useRunnerGps';
import { MapView, Recenter } from '@/components/map/MapView';
import { runnerIcon } from '@/components/map/icons';
import { Tabs } from '@/components/ui/Tabs';
import { EmptyState, Skeleton, Stat, Switch } from '@/components/ui';
import { StatusBadge } from '@/components/order/StatusBadge';
import { DEFAULT_CENTER, STATUS_META, VEHICLES } from '@/lib/constants';
import { cn, km, money, pluralize, timeAgo } from '@/lib/utils';

export default function RunnerHome() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'active' | 'past'>('active');
  const profile = useQuery({ queryKey: ['runner', 'profile'], queryFn: api.runner.profile });
  const earnings = useQuery({ queryKey: ['runner', 'earnings'], queryFn: api.runner.earnings });
  const q = useQuery({ queryKey: ['runner', 'deliveries', tab], queryFn: () => api.runner.deliveries(tab), refetchInterval: tab === 'active' ? 20_000 : false });
  const { pos, error } = useRunnerPosition();
  const toggle = useMutation({
    mutationFn: (isAvailable: boolean) => api.runner.updateProfile({ isAvailable, ...(pos ?? {}) }),
    onSuccess: (p) => { qc.setQueryData(['runner', 'profile'], (old: unknown) => ({ ...(old as object), ...p })); toast.success(p.isAvailable ? "You're online — shops can assign you deliveries" : "You're offline"); },
    onError: (e) => toast.error((e as Error).message),
  });
  const online = !!profile.data?.isAvailable;
  const center = pos ?? (profile.data?.lat && profile.data.lng ? { lat: profile.data.lat, lng: profile.data.lng } : DEFAULT_CENTER);

  return (
    <div className="mx-auto max-w-3xl">
      <section className={cn('mb-4 overflow-hidden rounded-3xl text-white shadow-card transition-colors', online ? 'bg-gradient-to-br from-brand-600 to-brand-800' : 'bg-gradient-to-br from-slate-700 to-slate-900')}>
        <div className="flex items-center gap-4 p-5">
          <div className="flex-1">
            <div className="text-xs font-semibold uppercase tracking-wide text-white/70">{online ? 'You are online' : 'You are offline'}</div>
            <div className="text-2xl font-extrabold">{online ? 'Ready for deliveries 🛵' : 'Go online to get work'}</div>
            <div className="mt-1 text-xs text-white/70">{VEHICLES[profile.data?.vehicleType ?? 'bike']?.emoji} {VEHICLES[profile.data?.vehicleType ?? 'bike']?.label} · ★ {profile.data?.ratingAvg || 'New'} · {profile.data?.totalDeliveries ?? 0} deliveries</div>
          </div>
          <Switch checked={online} onChange={(v) => toggle.mutate(v)} disabled={profile.isLoading || toggle.isPending} />
        </div>
        <div className="relative h-36">
          <MapView center={center} zoom={14} className="h-full" interactive={false}>
            <Recenter center={center} animate />
            {pos && <Marker position={[pos.lat, pos.lng]} icon={runnerIcon(VEHICLES[profile.data?.vehicleType ?? 'bike']?.emoji)} />}
          </MapView>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-black/20 to-transparent" />
          <div className="absolute bottom-2 left-3 z-[400] rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-ink shadow">{pos ? <><Navigation className="mr-1 inline h-3 w-3 text-brand-600" />GPS live</> : error ? <><MapPin className="mr-1 inline h-3 w-3 text-rose-500" />{error}</> : 'Waiting for GPS…'}</div>
        </div>
      </section>

      <div className="mb-4 grid grid-cols-3 gap-2">
        <Stat label="Today" value={money(earnings.data?.today.amount ?? 0)} sub={pluralize(earnings.data?.today.deliveries ?? 0, 'delivery', 'deliveries')} />
        <Stat label="This week" value={money(earnings.data?.week.amount ?? 0, { compact: true })} sub={pluralize(earnings.data?.week.deliveries ?? 0, 'delivery', 'deliveries')} />
        <Stat label="Tips" value={money(earnings.data?.tips ?? 0)} sub="all time" />
      </div>

      <Tabs tabs={[{ id: 'active', label: 'Active', count: tab === 'active' ? q.data?.length : undefined }, { id: 'past', label: 'Completed' }]} value={tab} onChange={setTab} className="max-w-xs" />
      <div className="mt-3 space-y-3">
        {q.isLoading && [1, 2].map((i) => <Skeleton key={i} className="h-32" />)}
        {q.data?.length === 0 && (tab === 'active' ? <EmptyState emoji={online ? '📡' : '😴'} title={online ? 'No deliveries assigned yet' : "You're offline"} description={online ? 'Shops assign riders when orders are accepted. Stay near busy areas!' : 'Flip the switch above to start receiving deliveries.'} /> : <EmptyState emoji="🧾" title="No completed deliveries yet" />)}
        {q.data?.map((o) => (
          <Link key={o.id} to={`/runner/deliveries/${o.id}`} className="card block p-4 transition hover:shadow-float">
            <div className="flex items-start justify-between gap-2">
              <div><div className="flex items-center gap-2 font-bold">{o.orderNumber}<StatusBadge status={o.status} /></div><div className="text-xs text-slate-500">{timeAgo(o.createdAt)}</div></div>
              <div className="text-right"><div className="text-lg font-extrabold text-brand-700 tabular">+{money(o.deliveryFee + o.tip)}</div><div className="text-[11px] text-slate-500">{o.tip > 0 ? `incl. ${money(o.tip)} tip` : 'delivery fee'}</div></div>
            </div>
            <div className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <span className="text-lg">🏪</span><div><div className="font-semibold">{o.shop.name}</div><div className="text-xs text-slate-500">{o.shop.addressLine}</div></div>
              <span className="text-lg">🏠</span><div><div className="font-semibold">{o.customer.name}</div><div className="text-xs text-slate-500">{[o.deliveryAddress.line1, o.deliveryAddress.area].filter(Boolean).join(', ')} · {km(o.distanceKm)}</div></div>
            </div>
            {o.paymentMethod === 'COD' && o.paymentStatus !== 'PAID' && <div className="mt-3 rounded-xl bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">💵 Collect {money(o.total)} cash on delivery</div>}
            {o.status === 'READY' && <div className="mt-3 rounded-xl bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-800">📦 Ready at the shop — head over for pickup</div>}
            {['ACCEPTED', 'PREPARING'].includes(o.status) && <div className="mt-3 rounded-xl bg-slate-50 px-3 py-1.5 text-xs text-slate-600">{STATUS_META[o.status].emoji} Shop is still preparing. You'll be notified when it's ready.</div>}
          </Link>
        ))}
      </div>
      {tab === 'active' && q.data && q.data.length > 0 && <p className="mt-4 text-center text-xs text-slate-400">Tap a delivery for navigation, chat and status updates.</p>}
    </div>
  );
}
