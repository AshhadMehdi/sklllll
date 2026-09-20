import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, ArrowRight, Clock, ShoppingBag, Star, TrendingUp, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { DashHeader } from '@/components/layout/PageHeader';
import { OrderCard } from '@/components/order/OrderCard';
import { Badge, Button, Skeleton, Stat, Switch } from '@/components/ui';
import { STATUS_META } from '@/lib/constants';
import { fmtShortDate, money, pluralize } from '@/lib/utils';
import { useState } from 'react';

export default function MerchantDashboard() {
  const qc = useQueryClient();
  const [days, setDays] = useState(14);
  const shop = useQuery({ queryKey: ['merchant', 'shop'], queryFn: api.merchant.shop });
  const a = useQuery({ queryKey: ['merchant', 'analytics', days], queryFn: () => api.merchant.analytics(days) });
  const newOrders = useQuery({ queryKey: ['merchant', 'orders', 'new'], queryFn: () => api.merchant.orders('new') });
  const toggleOpen = useMutation({
    mutationFn: (isOpen: boolean) => api.merchant.updateShop({ isOpen }),
    onSuccess: (s) => { qc.setQueryData(['merchant', 'shop'], (old: unknown) => ({ ...(old as object), ...s })); toast.success(s.isOpen ? 'Shop is now accepting orders' : 'Shop paused — customers see you as closed'); },
    onError: (e) => toast.error((e as Error).message),
  });
  const d = a.data;
  return (
    <div>
      <DashHeader title={`Salam, ${shop.data?.name ?? ''} 👋`} subtitle={shop.data ? (shop.data.isOpenNow ? 'You are open and visible to nearby customers.' : shop.data.isOpen ? `Closed by schedule${shop.data.opensAt ? ` · opens ${shop.data.opensAt}` : ''}` : 'Paused — not accepting orders') : undefined}
        action={shop.data && (
          <div className="flex items-center gap-3 rounded-2xl bg-white px-4 py-2.5 shadow-card"><span className="text-sm font-semibold">{shop.data.isOpen ? 'Accepting orders' : 'Paused'}</span><Switch checked={shop.data.isOpen} onChange={(v) => toggleOpen.mutate(v)} disabled={toggleOpen.isPending} /></div>
        )} />

      {shop.data?.status === 'SUSPENDED' && <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><b>Your shop is suspended.</b> Customers cannot see it. Please contact support.</div>}
      {shop.data?.status === 'PENDING' && <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"><b>Awaiting approval.</b> An admin will review your shop shortly; you can add products in the meantime.</div>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {a.isLoading ? [1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />) : d && (<>
          <Stat tone="brand" label="Today's sales" value={money(d.today.revenue)} sub={pluralize(d.today.orders, 'order')} icon={<TrendingUp className="h-4 w-4" />} />
          <Stat label="Needs action" value={d.today.pending} sub="new orders waiting" icon={<Clock className="h-4 w-4" />} />
          <Stat label={`Revenue · ${days}d`} value={money(d.totals.revenue, { compact: true })} sub={`Net payout ${money(d.totals.netPayout, { compact: true })}`} icon={<Wallet className="h-4 w-4" />} />
          <Stat label="Rating" value={d.totals.rating ? d.totals.rating.toFixed(1) : '—'} sub={pluralize(d.totals.ratingCount, 'review')} icon={<Star className="h-4 w-4" />} />
        </>)}
      </div>

      {(newOrders.data?.length ?? 0) > 0 && (
        <section className="mt-6">
          <div className="mb-2 flex items-center justify-between"><h2 className="font-bold">🔔 New orders</h2><Link to="/merchant/orders" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700">All orders <ArrowRight className="h-4 w-4" /></Link></div>
          <div className="grid gap-3 md:grid-cols-2">{newOrders.data!.slice(0, 4).map((o) => <OrderCard key={o.id} order={o} to={`/merchant/orders/${o.id}`} perspective="merchant" />)}</div>
        </section>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <section className="card p-4 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold">Revenue</h2>
            <div className="flex gap-1 rounded-xl bg-slate-100 p-1 text-xs font-semibold">{[7, 14, 30].map((n) => <button key={n} onClick={() => setDays(n)} className={`rounded-lg px-2.5 py-1 ${days === n ? 'bg-white shadow-sm' : 'text-slate-500'}`}>{n}d</button>)}</div>
          </div>
          <div className="h-56">
            {d && (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={d.series} margin={{ left: -18, right: 6, top: 6 }}>
                  <defs><linearGradient id="rev" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#16a34a" stopOpacity={0.35} /><stop offset="100%" stopColor="#16a34a" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" tickFormatter={fmtShortDate} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} />
                  <Tooltip formatter={(v: number, n: string) => (n === 'revenue' ? money(v) : v)} labelFormatter={(l) => fmtShortDate(String(l))} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  <Area type="monotone" dataKey="revenue" stroke="#16a34a" strokeWidth={2.5} fill="url(#rev)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>
        <section className="card p-4">
          <h2 className="mb-3 font-bold">Orders by status</h2>
          <div className="space-y-2">
            {d?.statusCounts.filter((s) => s.count > 0).map((s) => {
              const total = d.totals.orders || 1;
              return (
                <div key={s.status}>
                  <div className="mb-1 flex items-center justify-between text-xs"><span className="font-semibold">{STATUS_META[s.status].emoji} {STATUS_META[s.status].short}</span><span className="text-slate-500">{s.count}</span></div>
                  <div className="h-2 rounded-full bg-slate-100"><div className={`h-2 rounded-full ${STATUS_META[s.status].dot}`} style={{ width: `${Math.max(4, (s.count / total) * 100)}%` }} /></div>
                </div>
              );
            })}
            {d && d.totals.orders === 0 && <p className="text-sm text-slate-500">No orders in this period yet.</p>}
          </div>
          {d && <div className="mt-4 grid grid-cols-2 gap-2 text-center text-xs"><div className="rounded-xl bg-slate-50 p-2"><div className="text-lg font-extrabold tabular">{money(d.totals.avgOrderValue)}</div>avg order</div><div className="rounded-xl bg-slate-50 p-2"><div className="text-lg font-extrabold tabular">{d.totals.orders ? Math.round((d.totals.delivered / d.totals.orders) * 100) : 0}%</div>completed</div></div>}
        </section>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="card p-4">
          <h2 className="mb-3 font-bold">Top products</h2>
          {d && d.topProducts.length > 0 ? (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={d.topProducts.slice(0, 6)} layout="vertical" margin={{ left: 8, right: 12 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v: number, n: string) => (n === 'revenue' ? money(v) : v)} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  <Bar dataKey="quantity" fill="#f97316" radius={[0, 8, 8, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <p className="text-sm text-slate-500">Sell a few things and your bestsellers will show here.</p>}
        </section>
        <section className="card p-4">
          <div className="mb-3 flex items-center justify-between"><h2 className="font-bold">Low stock</h2><Link to="/merchant/products" className="text-sm font-semibold text-brand-700">Manage</Link></div>
          {d && d.lowStock.length === 0 && <p className="text-sm text-slate-500">All products are well stocked. 🎉</p>}
          <div className="space-y-2">
            {d?.lowStock.slice(0, 6).map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2">
                <span className="text-xl">{p.emoji || '📦'}</span>
                <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{p.name}</div><div className="text-xs text-slate-500">{p.category}</div></div>
                {p.stock === 0 || !p.isAvailable ? <Badge tone="rose">{p.isAvailable ? 'Out of stock' : 'Hidden'}</Badge> : <Badge tone="amber"><AlertTriangle className="mr-1 inline h-3 w-3" />{p.stock} left</Badge>}
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link to="/merchant/products"><Button variant="outline" leftIcon={<ShoppingBag className="h-4 w-4" />}>Add a product</Button></Link>
        <Link to="/merchant/shop"><Button variant="outline">Delivery zones & hours</Button></Link>
        <Link to={`/shop/${shop.data?.slug ?? ''}`} target="_blank"><Button variant="ghost">Preview my storefront ↗</Button></Link>
      </div>
    </div>
  );
}
