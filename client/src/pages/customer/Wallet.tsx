import { useQuery } from '@tanstack/react-query';
import { Coins } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState, Skeleton } from '@/components/ui';
import { useConfig } from '@/hooks/useConfig';
import { fmtDate, money } from '@/lib/utils';

export default function Wallet() {
  const { config } = useConfig();
  const q = useQuery({ queryKey: ['wallet'], queryFn: api.users.wallet });
  return (
    <div className="min-h-dvh">
      <PageHeader title="Qareeb points" back="/profile" />
      <div className="space-y-4 px-4 pt-4">
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-ink via-slate-800 to-slate-900 p-5 text-white">
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-accent-500/30 blur-2xl" />
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/60"><Coins className="h-4 w-4 text-accent-400" /> Balance</div>
          <div className="mt-2 text-4xl font-extrabold tabular">{q.data?.walletPoints ?? '—'} <span className="text-lg font-semibold text-white/60">pts</span></div>
          <p className="mt-2 text-sm text-white/70">1 point = Rs 1. Earn {config.pointsRatePct}% back on every delivered order and pay with points at checkout.</p>
        </section>
        <section>
          <h2 className="mb-2 font-bold">Activity</h2>
          <div className="card divide-y divide-slate-100">
            {q.isLoading && <div className="space-y-2 p-4"><Skeleton className="h-5" /><Skeleton className="h-5" /></div>}
            {q.data?.history.length === 0 && <EmptyState emoji="🪙" title="No activity yet" description="Points appear here when your orders are delivered." />}
            {q.data?.history.map((h) => (
              <div key={h.id} className="flex items-center gap-3 px-4 py-3">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-lg">{h.paymentMethod === 'WALLET' ? '🧾' : '✨'}</span>
                <div className="flex-1"><div className="text-sm font-semibold">{h.paymentMethod === 'WALLET' ? `Paid order ${h.orderNumber}` : `Earned on ${h.orderNumber}`}</div><div className="text-xs text-slate-500">{fmtDate(h.deliveredAt ?? h.createdAt)}</div></div>
                <div className="text-right text-sm font-bold tabular">
                  {h.paymentMethod === 'WALLET' && <div className={h.paymentStatus === 'REFUNDED' ? 'text-slate-400 line-through' : 'text-rose-600'}>−{Math.round(h.total)}</div>}
                  {h.pointsEarned > 0 && <div className="text-brand-700">+{h.pointsEarned}</div>}
                  <div className="text-[10px] font-normal text-slate-400">{money(h.total)}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
