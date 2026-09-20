import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuth } from '@/stores/auth';
import { DashHeader } from '@/components/layout/PageHeader';
import { Avatar, Button, Field, Input, Switch } from '@/components/ui';
import { useConfig } from '@/hooks/useConfig';
import { VEHICLES } from '@/lib/constants';
import { disablePush, enablePush, getPushSubscription, pushSupported } from '@/lib/push';
import { cn } from '@/lib/utils';

export default function RunnerProfile() {
  const qc = useQueryClient();
  const { user, setUser } = useAuth();
  const { config } = useConfig();
  const profile = useQuery({ queryKey: ['runner', 'profile'], queryFn: api.runner.profile });
  const [form, setForm] = useState({ name: user?.name ?? '', phone: user?.phone ?? '' });
  const [push, setPush] = useState(false);
  useEffect(() => { getPushSubscription().then((s) => setPush(!!s)); }, []);
  const saveMe = useMutation({ mutationFn: () => api.users.updateMe({ name: form.name, phone: form.phone || null }), onSuccess: (r) => { setUser(r.user); toast.success('Profile saved'); }, onError: (e) => toast.error((e as Error).message) });
  const vehicle = useMutation({ mutationFn: (vehicleType: string) => api.runner.updateProfile({ vehicleType }), onSuccess: (p) => { qc.setQueryData(['runner', 'profile'], (old: unknown) => ({ ...(old as object), ...p })); toast.success(`Vehicle set to ${VEHICLES[p.vehicleType]?.label}`); } });
  const togglePush = async (v: boolean) => { try { if (v) { const ok = await enablePush(config.vapidPublicKey); setPush(ok); if (!ok) toast.error('Notifications were not enabled'); } else { await disablePush(); setPush(false); } } catch (e) { toast.error((e as Error).message); } };
  if (!user) return null;
  return (
    <div className="mx-auto max-w-2xl">
      <DashHeader title="Rider profile" />
      <section className="card flex items-center gap-4 p-4">
        <Avatar name={user.name} src={user.avatarUrl} size="xl" />
        <div className="min-w-0 flex-1"><div className="text-lg font-bold">{user.name}</div><div className="text-sm text-slate-500">{user.email}</div><div className="text-xs text-slate-500">★ {profile.data?.ratingAvg || 'New'} · {profile.data?.totalDeliveries ?? 0} deliveries</div></div>
      </section>
      <section className="card mt-4 p-4">
        <h2 className="mb-3 font-bold">Vehicle</h2>
        <div className="grid grid-cols-5 gap-2">{Object.entries(VEHICLES).map(([k, v]) => <button key={k} onClick={() => vehicle.mutate(k)} className={cn('flex flex-col items-center gap-1 rounded-2xl border p-3 text-[11px] font-semibold', profile.data?.vehicleType === k ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-slate-100 bg-white text-slate-600')}><span className="text-2xl">{v.emoji}</span>{v.label}</button>)}</div>
      </section>
      <section className="card mt-4 p-4">
        <h2 className="mb-3 font-bold">Contact details</h2>
        <div className="grid gap-3 sm:grid-cols-2"><Field label="Name"><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></Field><Field label="Phone" hint="Customers and shops call this number"><Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+92 3xx xxxxxxx" /></Field></div>
        <div className="mt-3 flex justify-end"><Button onClick={() => saveMe.mutate()} loading={saveMe.isPending}>Save</Button></div>
      </section>
      <section className="card mt-4 flex items-center justify-between p-4"><div><div className="font-bold">Push notifications</div><div className="text-xs text-slate-500">{pushSupported() ? 'Get pinged when a shop assigns you a delivery' : 'Not supported in this browser'}</div></div><Switch checked={push} onChange={togglePush} disabled={!pushSupported()} /></section>
      <section className="card mt-4 p-4">
        <h2 className="mb-2 font-bold">Shops you ride for</h2>
        {profile.data?.shops?.length ? <div className="flex flex-wrap gap-2">{profile.data.shops.map((s) => <span key={s.id} className="chip">{config.categories.find((c) => c.id === s.category)?.emoji} {s.name}</span>)}</div> : <p className="text-sm text-slate-500">No shop has added you to their team yet. Shops can add you by your email; platform auto-assignment still works.</p>}
      </section>
    </div>
  );
}
