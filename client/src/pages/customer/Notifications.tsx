import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { CheckCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/stores/auth';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState, Skeleton } from '@/components/ui';
import type { Notification } from '@/lib/types';
import { cn, timeAgo } from '@/lib/utils';

const ICON: Record<Notification['type'], string> = { order: '🧾', delivery: '🛵', promo: '🎁', system: '🔔', chat: '💬' };

export default function Notifications() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const user = useAuth((s) => s.user);
  const q = useQuery({ queryKey: ['notifications'], queryFn: api.users.notifications });
  const readAll = useMutation({ mutationFn: api.users.readAll, onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }) });
  const readOne = useMutation({ mutationFn: api.users.readOne, onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }) });
  const isDash = user?.role !== 'CUSTOMER';

  const open = (n: Notification) => {
    if (!n.isRead) readOne.mutate(n.id);
    const url = (n.data?.url as string | undefined) ?? (n.data?.orderId ? (user?.role === 'MERCHANT' ? `/merchant/orders/${n.data.orderId}` : user?.role === 'RUNNER' ? `/runner/deliveries/${n.data.orderId}` : `/orders/${n.data.orderId}`) : null);
    if (url) nav(url);
  };

  const content = (
    <div className={cn('space-y-2', !isDash && 'px-4 pt-4')}>
      {q.isLoading && [1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}
      {q.data?.notifications.length === 0 && <EmptyState emoji="🔔" title="You're all caught up" description="Order updates, rider messages and offers will show up here." />}
      {q.data?.notifications.map((n) => (
        <button key={n.id} onClick={() => open(n)} className={cn('card flex w-full items-start gap-3 p-3.5 text-left', !n.isRead && 'border-brand-200 bg-brand-50/40')}>
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-xl shadow-sm">{ICON[n.type] ?? '🔔'}</span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center justify-between gap-2"><span className={cn('truncate text-sm', !n.isRead ? 'font-bold' : 'font-semibold')}>{n.title}</span><span className="shrink-0 text-[11px] text-slate-400">{timeAgo(n.createdAt)}</span></span>
            <span className="mt-0.5 line-clamp-2 block text-xs text-slate-600">{n.body}</span>
          </span>
          {!n.isRead && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand-600" />}
        </button>
      ))}
    </div>
  );

  if (isDash) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="mb-4 flex items-center justify-between"><h1 className="text-2xl font-extrabold tracking-tight">Notifications</h1>{(q.data?.unread ?? 0) > 0 && <button onClick={() => readAll.mutate()} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700"><CheckCheck className="h-4 w-4" /> Mark all read</button>}</div>
        {content}
      </div>
    );
  }
  return (
    <div className="min-h-dvh">
      <PageHeader title="Notifications" back="/home" action={(q.data?.unread ?? 0) > 0 ? <button onClick={() => readAll.mutate()} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700"><CheckCheck className="h-4 w-4" /> Read all</button> : undefined} />
      {content}
    </div>
  );
}
