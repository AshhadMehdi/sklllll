import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Marker, Popup } from 'react-leaflet';
import { Bike, ShoppingBag, Store, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { useSocketEvent } from '@/lib/socket';
import { DashHeader } from '@/components/layout/PageHeader';
import { MapView } from '@/components/map/MapView';
import { runnerIcon, shopIcon } from '@/components/map/icons';
import { Skeleton, Stat } from '@/components/ui';
import { useConfig } from '@/hooks/useConfig';
import { STATUS_META } from '@/lib/constants';
import type { OrderStatus } from '@/lib/types';
import { fmtShortDate, money, pluralize } from '@/lib/utils';
import { useState } from 'react';

export default function AdminDashboard() {
  const { config } = useConfig();
  const s = useQuery({ queryKey: ['admin', 'stats'], queryFn: api.admin.stats, refetchInterval: 60_000 });
  const shops = useQuery({ queryKey: ['admin', 'shops', 'APPROVED'], queryFn: () => api.admin.shops({ status: 'APPROVED' }) });
  const [riders, setRiders] = useState<Record<string, { lat: number; lng: number; at: string }>>({});
  useSocketEvent<{ runnerId: string; lat: number; lng: number; at: string }>('runner:location', (p) => setRiders((r) => ({ ...r, [p.runnerId]: { lat: p.lat, lng: p.lng, at: p.at } })));
  const d = s.data;
  const statusList = d ? (Object.entries(d.orders) as [OrderStatus, number][]).filter(([, n]) => n > 0) : [];
  const totalOrders = statusList.reduce((a, [, n]) => a + n, 0) || 1;
  return (
    <div>
      <DashHeader title="Platform overview" subtitle={`${config.city.name} · live`} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {!d ? [1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />) : (<>
          <Stat tone="dark" label="GMV · 30 days" value={money(d.gmv, { compact: true })} sub={`Platform revenue ${money(d.platformRevenue, { compact: true })}`} icon={<ShoppingBag className="h-4 w-4" />} />
          <Stat label="Orders today" value={d.today.orders} sub={money(d.today.value)} icon={<ShoppingBag className="h-4 w-4" />} />
          <Stat label="Shops" value={d.shops.APPROVED} sub={d.shops.PENDING ? <Link to="/admin/shops?status=PENDING" className="font-semibold text-amber-600">{d.shops.PENDING} awaiting approval →</Link> : 'all approved'} icon={<Store className="h-4 w-4" />} />
          <Stat label="Riders online" value={d.activeRunners} sub={`${d.users.RUNNER} registered · ${pluralize(d.users.CUSTOMER, 'customer')}`} icon={<Bike className="h-4 w-4" />} />
        </>)}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <section className="card p-4 lg:col-span-2">
          <h2 className="mb-3 font-bold">Orders & GMV · last 14 days</h2>
          <div className="h-56">{d && (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={d.series} margin={{ left: -18, right: 6, top: 6 }}>
                <defs><linearGradient id="gmv" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0f172a" stopOpacity={0.3} /><stop offset="100%" stopColor="#0f172a" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" tickFormatter={fmtShortDate} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="l" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} />
                <YAxis yAxisId="r" orientation="right" hide />
                <Tooltip formatter={(v: number, n: string) => (n === 'gmv' ? money(v) : v)} labelFormatter={(l) => fmtShortDate(String(l))} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Area yAxisId="l" type="monotone" dataKey="gmv" stroke="#0f172a" strokeWidth={2} fill="url(#gmv)" />
                <Area yAxisId="r" type="monotone" dataKey="orders" stroke="#16a34a" strokeWidth={2} fill="transparent" />
              </AreaChart>
            </ResponsiveContainer>
          )}</div>
        </section>
        <section className="card p-4">
          <h2 className="mb-3 font-bold">Orders by status</h2>
          <div className="space-y-2">{statusList.map(([st, n]) => <div key={st}><div className="mb-1 flex justify-between text-xs"><span className="font-semibold">{STATUS_META[st].emoji} {STATUS_META[st].short}</span><span className="text-slate-500">{n}</span></div><div className="h-2 rounded-full bg-slate-100"><div className={`h-2 rounded-full ${STATUS_META[st].dot}`} style={{ width: `${Math.max(3, (n / totalOrders) * 100)}%` }} /></div></div>)}</div>
          <div className="mt-4 h-28">{d && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[{ n: 'Customers', v: d.users.CUSTOMER }, { n: 'Merchants', v: d.users.MERCHANT }, { n: 'Riders', v: d.users.RUNNER }]} margin={{ left: -24, right: 0 }}>
                <XAxis dataKey="n" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} /><Bar dataKey="v" name="users" fill="#16a34a" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}</div>
        </section>
      </div>

      <section className="card mt-4 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3"><h2 className="font-bold">Live map</h2><span className="text-xs text-slate-500">{shops.data?.length ?? 0} shops · {Object.keys(riders).length} riders moving <Users className="ml-1 inline h-3 w-3" /></span></div>
        <div className="h-80">
          <MapView center={{ lat: config.city.lat, lng: config.city.lng }} zoom={13} className="h-full">
            {shops.data?.map((s) => <Marker key={s.id} position={[s.lat, s.lng]} icon={shopIcon(config.categories.find((c) => c.id === s.category)?.emoji ?? '🏪', { closed: !s.isOpenNow })}><Popup><b>{s.name}</b><br />{s.orderCount} orders · ★ {s.ratingAvg || '—'}</Popup></Marker>)}
            {Object.entries(riders).map(([id, r]) => <Marker key={id} position={[r.lat, r.lng]} icon={runnerIcon()} />)}
          </MapView>
        </div>
      </section>
    </div>
  );
}
