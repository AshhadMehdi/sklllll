import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Phone, Plus, UserMinus, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { DashHeader } from '@/components/layout/PageHeader';
import { Avatar, Badge, Button, EmptyState, Field, Input, Skeleton } from '@/components/ui';
import { Sheet } from '@/components/ui/Sheet';
import { VEHICLES } from '@/lib/constants';
import type { RunnerSummary } from '@/lib/types';
import { km, telHref, timeAgo } from '@/lib/utils';

export default function MerchantRunners() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['merchant', 'runners'], queryFn: api.merchant.runners, refetchInterval: 30_000 });
  const [add, setAdd] = useState(false);
  const [email, setEmail] = useState('');
  const refresh = () => qc.invalidateQueries({ queryKey: ['merchant', 'runners'] });
  const addM = useMutation({ mutationFn: (data: { email?: string; runnerId?: string }) => api.merchant.addRunner(data), onSuccess: () => { refresh(); setAdd(false); setEmail(''); toast.success('Rider added to your team'); }, onError: (e) => toast.error((e as Error).message) });
  const removeM = useMutation({ mutationFn: (id: string) => api.merchant.removeRunner(id), onSuccess: () => { refresh(); toast.success('Rider removed'); }, onError: (e) => toast.error((e as Error).message) });

  const Row = ({ r, mine }: { r: RunnerSummary; mine: boolean }) => (
    <div className="card flex items-center gap-3 p-4">
      <div className="relative"><Avatar name={r.name} src={r.avatarUrl} size="lg" /><span className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full ring-2 ring-white ${r.isAvailable ? 'bg-brand-500' : 'bg-slate-300'}`} /></div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 font-bold">{r.name}{r.isAvailable ? <Badge tone="brand">Online</Badge> : <Badge>Offline</Badge>}{r.activeDeliveries > 0 && <Badge tone="amber">{r.activeDeliveries} active</Badge>}</div>
        <div className="text-xs text-slate-500">{VEHICLES[r.vehicleType]?.emoji} {VEHICLES[r.vehicleType]?.label} · ★ {r.ratingAvg || 'New'} · {r.totalDeliveries} deliveries{r.distanceKm != null && ` · ${km(r.distanceKm)} away`}{r.lastSeenAt && !r.isAvailable && ` · seen ${timeAgo(r.lastSeenAt)}`}</div>
      </div>
      {r.phone && <a href={telHref(r.phone)} className="grid h-9 w-9 place-items-center rounded-full bg-slate-100"><Phone className="h-4 w-4" /></a>}
      {mine ? <Button size="sm" variant="ghost" className="text-rose-600" leftIcon={<UserMinus className="h-4 w-4" />} onClick={() => removeM.mutate(r.id)}>Remove</Button> : <Button size="sm" variant="outline" leftIcon={<UserPlus className="h-4 w-4" />} onClick={() => addM.mutate({ runnerId: r.id })}>Add to team</Button>}
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl">
      <DashHeader title="Riders" subtitle="Your own riders get priority when auto-assigning. Platform riders fill the gaps." action={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setAdd(true)}>Add by email</Button>} />
      <section>
        <h2 className="mb-2 font-bold">My team</h2>
        <div className="space-y-2">
          {q.isLoading && [1, 2].map((i) => <Skeleton key={i} className="h-20" />)}
          {q.data?.mine.length === 0 && <EmptyState emoji="🛵" title="No riders on your team yet" description="Add a rider by the email they registered with, or pick one from the platform riders below." />}
          {q.data?.mine.map((r) => <Row key={r.id} r={r} mine />)}
        </div>
      </section>
      <section className="mt-6">
        <h2 className="mb-2 font-bold">Platform riders nearby</h2>
        <div className="space-y-2">
          {q.data?.available.length === 0 && <p className="text-sm text-slate-500">No other riders are registered right now.</p>}
          {q.data?.available.map((r) => <Row key={r.id} r={r} mine={false} />)}
        </div>
      </section>
      <Sheet open={add} onClose={() => setAdd(false)} title="Add a rider" footer={<Button block loading={addM.isPending} onClick={() => addM.mutate({ email: email.trim() })} disabled={!email.includes('@')}>Add rider</Button>}>
        <p className="mb-3 text-sm text-slate-600">The rider must already have a Qareeb rider account. Ask them to register with role <b>Rider</b>, then enter their email here.</p>
        <Field label="Rider email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="rider@example.com" /></Field>
      </Sheet>
    </div>
  );
}
