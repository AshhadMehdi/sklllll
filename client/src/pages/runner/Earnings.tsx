import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '@/lib/api';
import { DashHeader } from '@/components/layout/PageHeader';
import { EmptyState, Skeleton, Stat } from '@/components/ui';
import { fmtDate, fmtShortDate, km, money, pluralize } from '@/lib/utils';

export default function RunnerEarnings() {
  const q = useQuery({ queryKey: ['runner', 'earnings'], queryFn: api.runner.earnings });
  const d = q.data;
  return (
    <div className="mx-auto max-w-3xl">
      <DashHeader title="Earnings" subtitle="Delivery fees plus tips, paid out weekly." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {!d ? [1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />) : (<>
          <Stat tone="accent" label="Today" value={money(d.today.amount)} sub={pluralize(d.today.deliveries, 'delivery', 'deliveries')} />
          <Stat label="This week" value={money(d.week.amount)} sub={pluralize(d.week.deliveries, 'delivery', 'deliveries')} />
          <Stat label="This month" value={money(d.month.amount, { compact: true })} sub={`${km(d.month.distanceKm)} ridden`} />
          <Stat label="Rating" value={d.rating ? d.rating.toFixed(1) : '—'} sub={`${d.ratingCount} ratings · ${d.totalDeliveries} total`} />
        </>)}
      </div>
      <section className="card mt-4 p-4">
        <h2 className="mb-3 font-bold">Last 14 days</h2>
        <div className="h-52">
          {d && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.series} margin={{ left: -18, right: 6 }}>
                <CartesianGrid vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" tickFormatter={fmtShortDate} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: number, n: string) => (n === 'amount' ? money(v) : v)} labelFormatter={(l) => fmtShortDate(String(l))} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Bar dataKey="amount" fill="#f97316" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>
      <section className="mt-4">
        <h2 className="mb-2 font-bold">Recent deliveries</h2>
        <div className="card divide-y divide-slate-100">
          {d?.recent.length === 0 && <EmptyState emoji="🛵" title="No deliveries yet" description="Completed deliveries and tips will be listed here." />}
          {d?.recent.map((r) => (
            <div key={r.id} className="flex items-center gap-3 px-4 py-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-lg">✅</span>
              <div className="flex-1"><div className="text-sm font-semibold">{r.orderNumber}</div><div className="text-xs text-slate-500">{fmtDate(r.deliveredAt)} · {km(r.distanceKm)}</div></div>
              <div className="text-right"><div className="font-bold text-brand-700 tabular">+{money(r.deliveryFee + r.tip)}</div>{r.tip > 0 && <div className="text-[11px] text-slate-500">incl. {money(r.tip)} tip</div>}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
