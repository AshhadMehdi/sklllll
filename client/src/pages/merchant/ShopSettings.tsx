import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Circle, Marker } from 'react-leaflet';
import { ImagePlus, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { DashHeader } from '@/components/layout/PageHeader';
import { LocationPicker } from '@/components/map/LocationPicker';
import { InvalidateOnMount, MapView } from '@/components/map/MapView';
import { shopIcon } from '@/components/map/icons';
import { Button, Field, Input, PageSpinner, Select, Switch, Textarea } from '@/components/ui';
import { Tabs } from '@/components/ui/Tabs';
import { useConfig } from '@/hooks/useConfig';
import { DAY_KEYS, DAY_LABELS } from '@/lib/constants';
import type { DeliveryZone, Shop, ShopHours } from '@/lib/types';
import { cn, money } from '@/lib/utils';

type ZoneDraft = Omit<DeliveryZone, 'id' | 'shopId' | 'sortOrder'>;
const RING_COLORS = ['#16a34a', '#0ea5e9', '#f97316', '#a855f7', '#e11d48', '#0f172a'];

export default function ShopSettings() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['merchant', 'shop'], queryFn: api.merchant.shop });
  const [tab, setTab] = useState<'details' | 'hours' | 'zones'>('details');
  if (q.isLoading || !q.data) return <PageSpinner />;
  const shop = q.data;
  const onSaved = (s: Partial<Shop>) => { qc.setQueryData(['merchant', 'shop'], { ...shop, ...s }); qc.invalidateQueries({ queryKey: ['merchant', 'shop'] }); };
  return (
    <div className="mx-auto max-w-3xl">
      <DashHeader title="Shop settings" subtitle="What customers see, when you're open, and where you deliver." />
      <Tabs tabs={[{ id: 'details', label: 'Details' }, { id: 'hours', label: 'Hours' }, { id: 'zones', label: 'Delivery zones' }]} value={tab} onChange={setTab} className="mb-5 max-w-md" />
      {tab === 'details' && <DetailsForm shop={shop} onSaved={onSaved} />}
      {tab === 'hours' && <HoursForm shop={shop} onSaved={onSaved} />}
      {tab === 'zones' && <ZonesForm shop={shop} onSaved={(zones) => onSaved({ zones, maxRadiusKm: Math.max(...zones.map((z) => z.radiusKm)) })} />}
    </div>
  );
}

export function ShopDetailsFields({ f, set, categories, uploading, onUpload }: { f: DetailsState; set: <K extends keyof DetailsState>(k: K, v: DetailsState[K]) => void; categories: { id: string; label: string; emoji: string }[]; uploading: string | null; onUpload: (kind: 'logoUrl' | 'coverUrl', file: File) => void }) {
  const logoRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <div className="relative mb-8 h-40 overflow-hidden rounded-2xl bg-slate-100">
        {f.coverUrl ? <img src={f.coverUrl} alt="" className="h-full w-full object-cover" /> : <img src={`/images/covers/${f.category || 'other'}.jpg`} alt="" className="h-full w-full object-cover opacity-70" />}
        <button type="button" onClick={() => coverRef.current?.click()} className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-xl bg-white/90 px-3 py-1.5 text-xs font-semibold shadow"><ImagePlus className="h-3.5 w-3.5" /> {uploading === 'coverUrl' ? 'Uploading…' : 'Cover photo'}</button>
        <input ref={coverRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && onUpload('coverUrl', e.target.files[0])} />
        <button type="button" onClick={() => logoRef.current?.click()} className="absolute -bottom-0 left-4 grid h-20 w-20 translate-y-6 place-items-center overflow-hidden rounded-2xl bg-white text-3xl shadow-card ring-4 ring-white">
          {f.logoUrl ? <img src={f.logoUrl} alt="" className="h-full w-full object-cover" /> : categories.find((c) => c.id === f.category)?.emoji ?? '🏪'}
          <span className="absolute inset-x-0 bottom-0 bg-ink/60 py-0.5 text-center text-[9px] font-semibold text-white">{uploading === 'logoUrl' ? '…' : 'Logo'}</span>
        </button>
        <input ref={logoRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && onUpload('logoUrl', e.target.files[0])} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Shop name" required><Input value={f.name} onChange={(e) => set('name', e.target.value)} /></Field>
        <Field label="Category" required><Select value={f.category} onChange={(e) => set('category', e.target.value)}>{categories.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}</Select></Field>
        <Field label="Phone" hint="Customers and riders can call this number"><Input value={f.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+92 3xx xxxxxxx" /></Field>
        <Field label="Tags" hint="Comma separated, e.g. halal, organic"><Input value={f.tags} onChange={(e) => set('tags', e.target.value)} /></Field>
      </div>
      <Field label="Description" className="mt-3"><Textarea value={f.description} onChange={(e) => set('description', e.target.value)} placeholder="Tell customers what makes your shop special" /></Field>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Field label="Prep time (minutes)" hint="Used to estimate delivery time"><Input type="number" min={0} max={240} value={f.prepTimeMin} onChange={(e) => set('prepTimeMin', e.target.value)} /></Field>
        <Field label="Minimum order (Rs)"><Input type="number" min={0} value={f.minOrder} onChange={(e) => set('minOrder', e.target.value)} /></Field>
      </div>
    </>
  );
}

export interface DetailsState { name: string; category: string; phone: string; description: string; tags: string; prepTimeMin: string; minOrder: string; logoUrl: string | null; coverUrl: string | null; addressLine: string; lat: number; lng: number }
export const detailsPayload = (f: DetailsState) => ({ name: f.name.trim(), category: f.category, phone: f.phone.trim() || null, description: f.description.trim() || null, tags: f.tags.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 10), prepTimeMin: Math.round(Number(f.prepTimeMin) || 0), minOrder: Math.round(Number(f.minOrder) || 0), logoUrl: f.logoUrl, coverUrl: f.coverUrl, addressLine: f.addressLine.trim(), lat: f.lat, lng: f.lng });

function DetailsForm({ shop, onSaved }: { shop: Shop; onSaved: (s: Partial<Shop>) => void }) {
  const { config } = useConfig();
  const [f, setF] = useState<DetailsState>({ name: shop.name, category: shop.category, phone: shop.phone ?? '', description: shop.description ?? '', tags: shop.tags.join(', '), prepTimeMin: String(shop.prepTimeMin), minOrder: String(shop.minOrder), logoUrl: shop.logoUrl, coverUrl: shop.coverUrl, addressLine: shop.addressLine, lat: shop.lat, lng: shop.lng });
  const [uploading, setUploading] = useState<string | null>(null);
  const set = <K extends keyof DetailsState>(k: K, v: DetailsState[K]) => setF((s) => ({ ...s, [k]: v }));
  const save = useMutation({ mutationFn: () => api.merchant.updateShop(detailsPayload(f)), onSuccess: (s) => { onSaved(s); toast.success('Shop details saved'); }, onError: (e) => toast.error((e as Error).message) });
  const onUpload = async (kind: 'logoUrl' | 'coverUrl', file: File) => { setUploading(kind); try { const r = await api.upload(file); set(kind, r.url); } catch (e) { toast.error((e as Error).message); } finally { setUploading(null); } };
  return (
    <form className="card p-5" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
      <ShopDetailsFields f={f} set={set} categories={config.categories} uploading={uploading} onUpload={onUpload} />
      <h3 className="mb-2 mt-6 font-bold">Location</h3>
      <p className="mb-2 text-xs text-slate-500">Drag the map so the pin sits on your shop — delivery distances are measured from here.</p>
      <LocationPicker value={{ lat: f.lat, lng: f.lng }} onChange={(c, geo) => { setF((s) => ({ ...s, lat: c.lat, lng: c.lng, addressLine: geo?.short && !s.addressLine ? geo.short : s.addressLine })); }} height="h-64" />
      <Field label="Address line" required className="mt-3"><Input value={f.addressLine} onChange={(e) => set('addressLine', e.target.value)} placeholder="Shop 4, Main Bazaar, Abbottabad" /></Field>
      <div className="mt-5 flex justify-end"><Button type="submit" loading={save.isPending}>Save details</Button></div>
    </form>
  );
}

export function HoursEditor({ hours, onChange }: { hours: ShopHours; onChange: (h: ShopHours) => void }) {
  const setDay = (d: keyof ShopHours, patch: Partial<ShopHours[keyof ShopHours]>) => onChange({ ...hours, [d]: { ...hours[d], ...patch } });
  const copyToAll = (d: keyof ShopHours) => { const src = hours[d]; const next = { ...hours }; for (const k of DAY_KEYS) next[k] = { ...src }; onChange(next); toast.success(`Copied ${DAY_LABELS[d]} to every day`); };
  return (
    <div className="divide-y divide-slate-100">
      {DAY_KEYS.map((d) => {
        const h = hours[d] ?? { open: '09:00', close: '21:00' };
        return (
          <div key={d} className="flex flex-wrap items-center gap-3 py-3">
            <span className="w-24 text-sm font-semibold">{DAY_LABELS[d]}</span>
            <Switch checked={!h.closed} onChange={(v) => setDay(d, { closed: !v })} />
            {h.closed ? <span className="text-sm text-slate-500">Closed</span> : (
              <div className="flex items-center gap-2 text-sm"><Input type="time" value={h.open} onChange={(e) => setDay(d, { open: e.target.value })} className="w-32" /><span className="text-slate-400">to</span><Input type="time" value={h.close} onChange={(e) => setDay(d, { close: e.target.value })} className="w-32" /></div>
            )}
            <button type="button" onClick={() => copyToAll(d)} className="ml-auto text-xs font-semibold text-brand-700">Copy to all</button>
          </div>
        );
      })}
    </div>
  );
}

function HoursForm({ shop, onSaved }: { shop: Shop; onSaved: (s: Partial<Shop>) => void }) {
  const [hours, setHours] = useState<ShopHours>(shop.hours);
  const [isOpen, setIsOpen] = useState(shop.isOpen);
  const save = useMutation({ mutationFn: () => api.merchant.updateShop({ hours, isOpen }), onSuccess: (s) => { onSaved(s); toast.success('Opening hours saved'); }, onError: (e) => toast.error((e as Error).message) });
  return (
    <form className="card p-5" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
      <div className="mb-4 flex items-center justify-between rounded-2xl bg-slate-50 p-4"><div><div className="font-bold">Accepting orders</div><div className="text-xs text-slate-500">Turn off to pause your shop instantly, regardless of hours.</div></div><Switch checked={isOpen} onChange={setIsOpen} /></div>
      <HoursEditor hours={hours} onChange={setHours} />
      <div className="mt-5 flex justify-end"><Button type="submit" loading={save.isPending}>Save hours</Button></div>
    </form>
  );
}

function ZonesForm({ shop, onSaved }: { shop: Shop; onSaved: (z: DeliveryZone[]) => void }) {
  const [zones, setZones] = useState<ZoneDraft[]>(shop.zones.length ? shop.zones.map(({ name, radiusKm, fee, freeAbove }) => ({ name, radiusKm, fee, freeAbove })) : [{ name: 'Nearby', radiusKm: 2, fee: 60, freeAbove: 1500 }]);
  const [mapKey, setMapKey] = useState(0);
  useEffect(() => { setMapKey((k) => k + 1); }, []);
  const set = (i: number, patch: Partial<ZoneDraft>) => setZones((z) => z.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const sorted = [...zones].map((z, i) => ({ ...z, i })).sort((a, b) => a.radiusKm - b.radiusKm);
  const save = useMutation({
    mutationFn: () => api.merchant.saveZones(zones.map((z) => ({ ...z, name: z.name.trim() || 'Zone', radiusKm: Number(z.radiusKm) || 1, fee: Number(z.fee) || 0, freeAbove: z.freeAbove ? Number(z.freeAbove) : null }))),
    onSuccess: (z) => { onSaved(z); toast.success('Delivery zones saved'); }, onError: (e) => toast.error((e as Error).message),
  });
  const maxKm = Math.max(1, ...zones.map((z) => Number(z.radiusKm) || 0));
  const zoom = maxKm <= 2 ? 14 : maxKm <= 4 ? 13 : maxKm <= 8 ? 12 : 11;
  return (
    <form className="grid gap-4 lg:grid-cols-[1fr_360px]" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
      <div className="card p-5">
        <p className="mb-3 text-sm text-slate-600">Delivery works in <b>rings</b> around your shop. A customer pays the fee of the first ring that reaches them; beyond the largest ring you don't deliver. Set <i>free above</i> to waive the fee for bigger baskets.</p>
        <div className="space-y-3">
          {zones.map((z, i) => (
            <div key={i} className="rounded-2xl border border-slate-100 p-3">
              <div className="mb-2 flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ background: RING_COLORS[sorted.findIndex((s) => s.i === i) % RING_COLORS.length] }} /><Input value={z.name} onChange={(e) => set(i, { name: e.target.value })} className="h-9 max-w-[160px]" placeholder="Zone name" />{zones.length > 1 && <button type="button" onClick={() => setZones((zs) => zs.filter((_, j) => j !== i))} className="ml-auto grid h-8 w-8 place-items-center rounded-lg bg-rose-50 text-rose-600"><Trash2 className="h-3.5 w-3.5" /></button>}</div>
              <div className="grid grid-cols-3 gap-2">
                <Field label="Radius (km)"><Input type="number" step="0.5" min={0.2} max={50} value={z.radiusKm} onChange={(e) => set(i, { radiusKm: Number(e.target.value) })} /></Field>
                <Field label="Fee (Rs)"><Input type="number" min={0} value={z.fee} onChange={(e) => set(i, { fee: Number(e.target.value) })} /></Field>
                <Field label="Free above (Rs)"><Input type="number" min={0} value={z.freeAbove ?? ''} placeholder="—" onChange={(e) => set(i, { freeAbove: e.target.value ? Number(e.target.value) : null })} /></Field>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          {zones.length < 6 && <Button type="button" variant="outline" size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setZones((zs) => [...zs, { name: `Zone ${zs.length + 1}`, radiusKm: Math.round((maxKm + 2) * 2) / 2, fee: (zs[zs.length - 1]?.fee ?? 60) + 60, freeAbove: null }])}>Add ring</Button>}
          <Button type="submit" loading={save.isPending}>Save zones</Button>
        </div>
      </div>
      <div className="card overflow-hidden">
        <div className="h-72 lg:h-full lg:min-h-[420px]">
          <MapView key={mapKey} center={{ lat: shop.lat, lng: shop.lng }} zoom={zoom} className="h-full">
            <InvalidateOnMount />
            {sorted.slice().reverse().map((z, idx) => <Circle key={z.i} center={[shop.lat, shop.lng]} radius={(Number(z.radiusKm) || 0) * 1000} pathOptions={{ color: RING_COLORS[(sorted.length - 1 - idx) % RING_COLORS.length], weight: 2, fillOpacity: 0.08 }} />)}
            <Marker position={[shop.lat, shop.lng]} icon={shopIcon(shop.categoryEmoji, { selected: true })} />
          </MapView>
        </div>
        <div className="space-y-1 p-3 text-xs">{sorted.map((z, idx) => <div key={z.i} className={cn('flex items-center gap-2')}><span className="h-2.5 w-2.5 rounded-full" style={{ background: RING_COLORS[idx % RING_COLORS.length] }} /><span className="font-semibold">{z.name}</span><span className="text-slate-500">≤ {z.radiusKm} km · {money(z.fee)}{z.freeAbove ? ` · free above ${money(z.freeAbove)}` : ''}</span></div>)}</div>
      </div>
    </form>
  );
}
