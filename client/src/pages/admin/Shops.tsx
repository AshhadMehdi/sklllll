import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { DashHeader } from '@/components/layout/PageHeader';
import { Badge, Button, Chip, EmptyState, Input, Skeleton } from '@/components/ui';
import { useConfig } from '@/hooks/useConfig';
import { fmtDate } from '@/lib/utils';

const STATUSES = ['all', 'PENDING', 'APPROVED', 'SUSPENDED'] as const;

export default function AdminShops() {
  const qc = useQueryClient();
  const { config } = useConfig();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? 'all';
  const [q, setQ] = useState('');
  const list = useQuery({ queryKey: ['admin', 'shops', status, q], queryFn: () => api.admin.shops({ status, q: q || undefined }) });
  const setStatus = useMutation({
    mutationFn: ({ id, status, note }: { id: string; status: string; note?: string }) => api.admin.setShopStatus(id, status, note),
    onSuccess: (s) => { qc.invalidateQueries({ queryKey: ['admin'] }); toast.success(`${s.name} is now ${s.status.toLowerCase()}`); },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <div>
      <DashHeader title="Shops" subtitle="Approve new merchants, suspend bad actors." />
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <Input leftIcon={<Search className="h-4 w-4" />} placeholder="Search by name or address…" value={q} onChange={(e) => setQ(e.target.value)} className="md:max-w-xs" />
        <div className="flex gap-2">{STATUSES.map((s) => <Chip key={s} active={status === s} onClick={() => setParams(s === 'all' ? {} : { status: s })}>{s === 'all' ? 'All' : s[0] + s.slice(1).toLowerCase()}</Chip>)}</div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {list.isLoading && [1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-36" />)}
        {list.data?.length === 0 && <div className="md:col-span-2"><EmptyState emoji="🏪" title="No shops match" /></div>}
        {list.data?.map((s) => (
          <div key={s.id} className="card p-4">
            <div className="flex items-start gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-brand-50 text-2xl">{s.logoUrl ? <img src={s.logoUrl} alt="" className="h-full w-full object-cover" /> : config.categories.find((c) => c.id === s.category)?.emoji}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 font-bold"><Link to={`/shop/${s.slug}`} className="hover:underline">{s.name}</Link><Badge tone={s.status === 'APPROVED' ? 'brand' : s.status === 'PENDING' ? 'amber' : 'rose'}>{s.status}</Badge>{s.isOpenNow && <Badge tone="sky">Open now</Badge>}</div>
                <div className="text-xs text-slate-500">{s.categoryLabel} · {s.addressLine}</div>
                <div className="mt-1 text-xs text-slate-500">Owner: {s.ownerName} · {s.ownerEmail}{s.ownerPhone ? ` · ${s.ownerPhone}` : ''}</div>
                <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-slate-500"><span>{s.productCount} products</span><span>{s.orderCount} orders</span><span>★ {s.ratingAvg || '—'} ({s.ratingCount})</span><span>Joined {fmtDate(s.createdAt)}</span></div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {s.status !== 'APPROVED' && <Button size="sm" onClick={() => setStatus.mutate({ id: s.id, status: 'APPROVED' })}>Approve</Button>}
              {s.status === 'APPROVED' && <Button size="sm" variant="outline" className="text-rose-600" onClick={() => { const note = prompt('Reason for suspension (sent to the merchant):', 'Policy violation'); if (note !== null) setStatus.mutate({ id: s.id, status: 'SUSPENDED', note }); }}>Suspend</Button>}
              {s.status === 'SUSPENDED' && <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ id: s.id, status: 'APPROVED', note: 'Reinstated' })}>Reinstate</Button>}
              <Link to={`/admin/orders?shop=${s.id}`}><Button size="sm" variant="ghost">Orders</Button></Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
