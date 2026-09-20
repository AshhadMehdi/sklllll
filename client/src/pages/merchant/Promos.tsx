import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { DashHeader } from '@/components/layout/PageHeader';
import { Badge, Button, EmptyState, Field, Input, Select, Skeleton, Switch } from '@/components/ui';
import { Sheet } from '@/components/ui/Sheet';
import type { Promo } from '@/lib/types';
import { fmtDate, money } from '@/lib/utils';

export const promoLabel = (p: Promo) => (p.type === 'PERCENT' ? `${p.value}% off${p.maxDiscount ? ` (max ${money(p.maxDiscount)})` : ''}` : p.type === 'FIXED' ? `${money(p.value)} off` : 'Free delivery');

export function PromoList({ promos, loading, onToggle, onDelete }: { promos?: Promo[]; loading?: boolean; onToggle: (p: Promo, v: boolean) => void; onDelete?: (p: Promo) => void }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {loading && [1, 2].map((i) => <Skeleton key={i} className="h-28" />)}
      {promos?.length === 0 && <div className="md:col-span-2"><EmptyState emoji="🎟️" title="No promo codes yet" description="Create a code to bring customers back — e.g. 10% off orders above Rs 1,000." /></div>}
      {promos?.map((p) => {
        const expired = p.expiresAt && new Date(p.expiresAt) < new Date();
        const exhausted = p.usageLimit != null && p.usedCount >= p.usageLimit;
        return (
          <div key={p.id} className="card p-4">
            <div className="flex items-start justify-between gap-2">
              <div><div className="flex items-center gap-2 font-mono text-lg font-extrabold tracking-wider">{p.code}{expired ? <Badge tone="rose">Expired</Badge> : exhausted ? <Badge tone="amber">Used up</Badge> : !p.isActive ? <Badge>Paused</Badge> : <Badge tone="brand">Live</Badge>}</div><div className="text-sm font-semibold text-brand-700">{promoLabel(p)}</div></div>
              <Switch checked={p.isActive} onChange={(v) => onToggle(p, v)} />
            </div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
              {p.minOrder > 0 && <span>Min order {money(p.minOrder)}</span>}
              <span>Used {p.usedCount}{p.usageLimit ? ` / ${p.usageLimit}` : ''}</span>
              {p.expiresAt && <span>Expires {fmtDate(p.expiresAt)}</span>}
              {p.shopName !== undefined && <span>{p.shopName ?? 'Platform-wide'}</span>}
            </div>
            {onDelete && <button onClick={() => onDelete(p)} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-rose-600"><Trash2 className="h-3.5 w-3.5" /> Delete</button>}
          </div>
        );
      })}
    </div>
  );
}

export function PromoForm({ onSubmit, busy }: { onSubmit: (data: Record<string, unknown>) => void; busy: boolean }) {
  const [f, setF] = useState({ code: '', type: 'PERCENT' as Promo['type'], value: '10', minOrder: '0', maxDiscount: '', expiresAt: '', usageLimit: '' });
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));
  return (
    <form className="space-y-3 pb-4" onSubmit={(e) => { e.preventDefault(); onSubmit({ code: f.code.toUpperCase().replace(/[^A-Z0-9]/g, ''), type: f.type, value: f.type === 'FREE_DELIVERY' ? 0 : Number(f.value) || 0, minOrder: Number(f.minOrder) || 0, maxDiscount: f.maxDiscount ? Number(f.maxDiscount) : null, expiresAt: f.expiresAt ? new Date(f.expiresAt).toISOString() : null, usageLimit: f.usageLimit ? Number(f.usageLimit) : null, isActive: true }); }}>
      <Field label="Code" required hint="Letters and numbers, 3–20 chars"><Input value={f.code} onChange={(e) => set('code', e.target.value.toUpperCase())} placeholder="EID10" className="font-mono uppercase tracking-wider" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type"><Select value={f.type} onChange={(e) => set('type', e.target.value)}><option value="PERCENT">Percent off</option><option value="FIXED">Fixed amount off</option><option value="FREE_DELIVERY">Free delivery</option></Select></Field>
        {f.type !== 'FREE_DELIVERY' && <Field label={f.type === 'PERCENT' ? 'Percent' : 'Amount (Rs)'}><Input type="number" min={0} value={f.value} onChange={(e) => set('value', e.target.value)} /></Field>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Min order (Rs)"><Input type="number" min={0} value={f.minOrder} onChange={(e) => set('minOrder', e.target.value)} /></Field>
        {f.type === 'PERCENT' && <Field label="Max discount (Rs)"><Input type="number" min={0} value={f.maxDiscount} onChange={(e) => set('maxDiscount', e.target.value)} placeholder="no cap" /></Field>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Expires"><Input type="date" value={f.expiresAt} onChange={(e) => set('expiresAt', e.target.value)} /></Field>
        <Field label="Usage limit"><Input type="number" min={1} value={f.usageLimit} onChange={(e) => set('usageLimit', e.target.value)} placeholder="unlimited" /></Field>
      </div>
      <Button type="submit" block size="lg" loading={busy} disabled={f.code.length < 3}>Create promo</Button>
    </form>
  );
}

export default function MerchantPromos() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['merchant', 'promos'], queryFn: api.merchant.promos });
  const [open, setOpen] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ['merchant', 'promos'] });
  const create = useMutation({ mutationFn: (data: unknown) => api.merchant.createPromo(data), onSuccess: () => { refresh(); setOpen(false); toast.success('Promo created'); }, onError: (e) => toast.error((e as Error).message) });
  const toggle = useMutation({ mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => api.merchant.updatePromo(id, { isActive }), onSuccess: refresh, onError: (e) => toast.error((e as Error).message) });
  const del = useMutation({ mutationFn: (id: string) => api.merchant.deletePromo(id), onSuccess: () => { refresh(); toast.success('Promo deleted'); } });
  return (
    <div className="mx-auto max-w-4xl">
      <DashHeader title="Promo codes" subtitle="Codes apply only to orders from your shop. Share them on WhatsApp or print them on receipts." action={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>New promo</Button>} />
      <PromoList promos={q.data} loading={q.isLoading} onToggle={(p, v) => toggle.mutate({ id: p.id, isActive: v })} onDelete={(p) => { if (confirm(`Delete ${p.code}?`)) del.mutate(p.id); }} />
      <Sheet open={open} onClose={() => setOpen(false)} title="New promo code"><PromoForm onSubmit={(d) => create.mutate(d)} busy={create.isPending} /></Sheet>
    </div>
  );
}
