import { Check } from 'lucide-react';
import { STATUS_FLOW, STATUS_META } from '@/lib/constants';
import type { Order } from '@/lib/types';
import { cn, fmtTime } from '@/lib/utils';

export function OrderTimeline({ order }: { order: Order }) {
  if (order.status === 'CANCELLED') {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
        <div className="font-bold text-rose-700">❌ Order cancelled</div>
        <div className="mt-0.5 text-sm text-rose-700/80">{order.cancelReason || 'No reason given'} · by {order.cancelledBy?.toLowerCase()} · {fmtTime(order.cancelledAt)}</div>
        {order.paymentStatus === 'REFUNDED' && <div className="mt-1 text-xs text-rose-700/80">Your payment has been refunded.</div>}
      </div>
    );
  }
  const idx = STATUS_FLOW.indexOf(order.status);
  const timeFor = (s: string) => order.events.filter((e) => e.status === s).at(-1)?.createdAt;
  return (
    <ol className="relative space-y-0">
      {STATUS_FLOW.map((s, i) => {
        const done = i < idx;
        const current = i === idx;
        const t = timeFor(s);
        const meta = STATUS_META[s];
        return (
          <li key={s} className="relative flex gap-3 pb-5 last:pb-0">
            {i < STATUS_FLOW.length - 1 && <span className={cn('absolute left-[13px] top-7 h-[calc(100%-10px)] w-0.5', done ? 'bg-brand-500' : 'bg-slate-200')} />}
            <span className={cn('relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs', done ? 'bg-brand-600 text-white' : current ? 'bg-white ring-4 ring-brand-500/25 text-base' : 'bg-slate-100 text-slate-300')}>
              {done ? <Check className="h-4 w-4" /> : current ? meta.emoji : <span className="h-2 w-2 rounded-full bg-current" />}
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className={cn('text-sm font-semibold', current ? 'text-ink' : done ? 'text-slate-700' : 'text-slate-400')}>{meta.label}</div>
              {(current || done) && <div className="text-xs text-slate-500">{t ? fmtTime(t) : current ? meta.description : ''}</div>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
