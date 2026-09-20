import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Megaphone, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { DashHeader } from '@/components/layout/PageHeader';
import { Button, Field, Input, Select, Switch, Textarea } from '@/components/ui';
import { Sheet } from '@/components/ui/Sheet';
import { PromoForm, PromoList } from '@/pages/merchant/Promos';

type S = { serviceFee: number; commissionPct: number; pointsRatePct: number; allowPlatformRunners: boolean; maxDeliveryRadiusKm: number; customerCancelWindowMin: number; cityName: string; cityLat: number; cityLng: number };

export default function AdminSettings() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin', 'settings'], queryFn: api.admin.settings });
  const [s, setS] = useState<S | null>(null);
  useEffect(() => { if (q.data && !s) setS(q.data.settings as S); }, [q.data, s]);
  const save = useMutation({ mutationFn: (data: S) => api.admin.updateSettings(data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'settings'] }); qc.invalidateQueries({ queryKey: ['config'] }); toast.success('Settings saved'); }, onError: (e) => toast.error((e as Error).message) });

  const promos = useQuery({ queryKey: ['admin', 'promos'], queryFn: api.admin.promos });
  const [promoOpen, setPromoOpen] = useState(false);
  const createPromo = useMutation({ mutationFn: (d: unknown) => api.admin.createPromo(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'promos'] }); setPromoOpen(false); toast.success('Platform promo created'); }, onError: (e) => toast.error((e as Error).message) });
  const togglePromo = useMutation({ mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => api.admin.updatePromo(id, { isActive }), onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'promos'] }) });

  const [bc, setBc] = useState({ title: '', body: '', role: '' });
  const broadcast = useMutation({ mutationFn: () => api.admin.broadcast({ title: bc.title, body: bc.body, role: bc.role || undefined }), onSuccess: (r) => { toast.success(`Sent to ${r.sent} users`); setBc({ title: '', body: '', role: '' }); }, onError: (e) => toast.error((e as Error).message) });

  const num = (k: keyof S) => (e: React.ChangeEvent<HTMLInputElement>) => setS((p) => (p ? { ...p, [k]: Number(e.target.value) } : p));
  return (
    <div className="mx-auto max-w-4xl">
      <DashHeader title="Platform settings" subtitle="Fees, loyalty, delivery limits and announcements." />
      <div className="grid gap-4 lg:grid-cols-2">
        <form className="card p-5" onSubmit={(e) => { e.preventDefault(); if (s) save.mutate(s); }}>
          <h2 className="mb-3 font-bold">Fees & rules</h2>
          {s && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Service fee (Rs / shop order)"><Input type="number" min={0} value={s.serviceFee} onChange={num('serviceFee')} /></Field>
                <Field label="Merchant commission (%)"><Input type="number" min={0} max={50} value={s.commissionPct} onChange={num('commissionPct')} /></Field>
                <Field label="Loyalty points (% of subtotal)"><Input type="number" min={0} max={20} step="0.5" value={s.pointsRatePct} onChange={num('pointsRatePct')} /></Field>
                <Field label="Max delivery radius (km)"><Input type="number" min={1} max={100} value={s.maxDeliveryRadiusKm} onChange={num('maxDeliveryRadiusKm')} /></Field>
                <Field label="Customer cancel window (min after accept)"><Input type="number" min={0} max={60} value={s.customerCancelWindowMin} onChange={num('customerCancelWindowMin')} /></Field>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5"><div><div className="text-sm font-semibold">Platform riders for auto-assign</div><div className="text-xs text-slate-500">When off, shops can only auto-assign their own team.</div></div><Switch checked={s.allowPlatformRunners} onChange={(v) => setS({ ...s, allowPlatformRunners: v })} /></div>
              <h3 className="pt-2 font-bold">City</h3>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Name"><Input value={s.cityName} onChange={(e) => setS({ ...s, cityName: e.target.value })} /></Field>
                <Field label="Latitude"><Input type="number" step="0.0001" value={s.cityLat} onChange={num('cityLat')} /></Field>
                <Field label="Longitude"><Input type="number" step="0.0001" value={s.cityLng} onChange={num('cityLng')} /></Field>
              </div>
              <div className="flex justify-end"><Button type="submit" loading={save.isPending}>Save settings</Button></div>
            </div>
          )}
        </form>
        <form className="card p-5" onSubmit={(e) => { e.preventDefault(); broadcast.mutate(); }}>
          <h2 className="mb-1 flex items-center gap-2 font-bold"><Megaphone className="h-4 w-4" /> Broadcast announcement</h2>
          <p className="mb-3 text-xs text-slate-500">Sends an in-app notification (and push, if enabled) to everyone or a single role.</p>
          <div className="space-y-3">
            <Field label="Audience"><Select value={bc.role} onChange={(e) => setBc({ ...bc, role: e.target.value })}><option value="">Everyone</option><option value="CUSTOMER">Customers</option><option value="MERCHANT">Merchants</option><option value="RUNNER">Riders</option></Select></Field>
            <Field label="Title"><Input value={bc.title} onChange={(e) => setBc({ ...bc, title: e.target.value })} placeholder="Eid delivery hours" /></Field>
            <Field label="Message"><Textarea value={bc.body} onChange={(e) => setBc({ ...bc, body: e.target.value })} placeholder="Shops close early on Chand Raat…" /></Field>
            <div className="flex justify-end"><Button type="submit" variant="dark" loading={broadcast.isPending} disabled={!bc.title || !bc.body}>Send</Button></div>
          </div>
        </form>
      </div>
      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between"><h2 className="font-bold">Promo codes (all shops)</h2><Button size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setPromoOpen(true)}>Platform promo</Button></div>
        <PromoList promos={promos.data} loading={promos.isLoading} onToggle={(p, v) => togglePromo.mutate({ id: p.id, isActive: v })} />
      </section>
      <Sheet open={promoOpen} onClose={() => setPromoOpen(false)} title="New platform-wide promo"><PromoForm onSubmit={(d) => createPromo.mutate(d)} busy={createPromo.isPending} /></Sheet>
    </div>
  );
}
