import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, ChevronRight, MapPin, Plus, Tag } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { groupByShop, useCart } from '@/stores/cart';
import { useAuth } from '@/stores/auth';
import { useLocation } from '@/stores/location';
import { useConfig } from '@/hooks/useConfig';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, Chip, Divider, Field, Input, Row, Textarea } from '@/components/ui';
import { Sheet } from '@/components/ui/Sheet';
import { LocationPicker } from '@/components/map/LocationPicker';
import { PAYMENT_META } from '@/lib/constants';
import type { Address, DeliveryAddress, PaymentMethod } from '@/lib/types';
import type { GeoResult } from '@/lib/geo';
import { cn, km, money, vibrate } from '@/lib/utils';

const TIPS = [0, 30, 50, 100];

export default function Checkout() {
  const nav = useNavigate();
  const { user } = useAuth();
  const { config } = useConfig();
  const { coords } = useLocation();
  const { items, shopNotes, clear } = useCart();
  const groups = groupByShop(items);

  const { data: addresses = [], refetch: refetchAddresses } = useQuery({ queryKey: ['addresses'], queryFn: api.users.addresses });
  const [addressId, setAddressId] = useState<string | null>(null);
  const [addrSheet, setAddrSheet] = useState(false);
  const [promoInput, setPromoInput] = useState('');
  const [promoCode, setPromoCode] = useState<string | null>(null);
  const [tip, setTip] = useState(0);
  const [payment, setPayment] = useState<PaymentMethod>('COD');
  const [notes, setNotes] = useState('');
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    if (!addressId && addresses.length) setAddressId((addresses.find((a) => a.isDefault) ?? addresses[0]).id);
  }, [addresses, addressId]);
  const address = addresses.find((a) => a.id === addressId) ?? null;

  const cartBody = useMemo(() => ({ addressId: addressId ?? undefined, promoCode, tip, shops: groups.map((g) => ({ shopId: g.shopId, notes: shopNotes[g.shopId] || undefined, items: g.items.map((i) => ({ productId: i.productId, quantity: i.quantity, note: i.note })) })) }), [addressId, promoCode, tip, groups, shopNotes]);
  const quote = useQuery({ queryKey: ['quote', cartBody], queryFn: () => api.orders.quote(cartBody), enabled: !!addressId && items.length > 0, placeholderData: (prev) => prev, retry: false });

  useEffect(() => {
    if (items.length === 0 && !paying) nav('/cart', { replace: true });
  }, [items.length, nav, paying]);

  const place = useMutation({
    mutationFn: async () => {
      if (payment !== 'COD') {
        setPaying(true);
        await new Promise((r) => setTimeout(r, 1800)); // simulated gateway round-trip
      }
      return api.orders.checkout({ ...cartBody, paymentMethod: payment, notes: notes || undefined });
    },
    onSuccess: (r) => {
      vibrate([40, 30, 80]);
      clear();
      toast.success(r.orders.length > 1 ? `${r.orders.length} orders placed! 🎉` : `Order ${r.orders[0].orderNumber} placed! 🎉`);
      nav(`/orders/${r.orders[0].id}`, { replace: true, state: { placed: true, groupId: r.groupId, count: r.orders.length } });
    },
    onError: (e) => {
      setPaying(false);
      toast.error((e as Error).message);
      quote.refetch();
    },
  });

  const q = quote.data;
  const walletShort = payment === 'WALLET' && q && (user?.walletPoints ?? 0) < q.grandTotal;
  const canPlace = !!q && q.ok && !!address && !walletShort && !place.isPending;

  return (
    <div className="min-h-dvh pb-40">
      <PageHeader title="Checkout" subtitle={`${groups.length} shop${groups.length > 1 ? 's' : ''} · ${items.length} items`} back="/cart" />
      <div className="space-y-4 px-4 pt-4">
        {/* Address */}
        <section className="card p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">Deliver to</h2>
            <button onClick={() => setAddrSheet(true)} className="text-sm font-semibold text-brand-700">{address ? 'Change' : 'Add address'}</button>
          </div>
          {address ? (
            <div className="mt-2 flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-lg">{/office|work/i.test(address.label) ? '🏢' : '🏠'}</span>
              <div className="min-w-0">
                <div className="font-semibold">{address.label}</div>
                <div className="text-sm text-slate-600">{[address.line1, address.area, address.city].filter(Boolean).join(', ')}</div>
                {address.instructions && <div className="mt-0.5 text-xs text-slate-500">“{address.instructions}”</div>}
              </div>
            </div>
          ) : (
            <button onClick={() => setAddrSheet(true)} className="mt-2 flex w-full items-center gap-2 rounded-xl border border-dashed border-brand-300 bg-brand-50/50 px-3 py-3 text-sm font-semibold text-brand-700"><Plus className="h-4 w-4" /> Add a delivery address to continue</button>
          )}
        </section>

        {/* Per shop breakdown */}
        {q?.shops.map((s) => (
          <section key={s.shopId} className={cn('card p-4', s.issues.length && 'border-rose-200')}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-bold">{s.shopName}</h3>
                <div className="text-xs text-slate-500">{km(s.distanceKm)} · {s.zoneName ? `${s.zoneName} zone` : 'out of zone'} · ETA ~{s.etaMinutes} min</div>
              </div>
              <div className="text-right"><div className="font-bold tabular">{money(s.total)}</div><div className="text-[11px] text-slate-500">{s.items.length} items</div></div>
            </div>
            <ul className="mt-2 space-y-1 text-sm text-slate-600">
              {s.items.map((l) => (
                <li key={l.productId} className={cn('flex justify-between', !l.available && 'text-rose-600 line-through')}><span>{l.quantity}× {l.name}</span><span className="tabular">{money(l.total)}</span></li>
              ))}
            </ul>
            <div className="mt-2 space-y-1 border-t border-slate-100 pt-2">
              <Row label="Delivery" value={s.deliveryFee === 0 ? <span className="font-semibold text-brand-700">Free</span> : money(s.deliveryFee)} />
              <Row label="Service fee" value={money(s.serviceFee)} />
              {s.discount > 0 && <Row label="Discount" value={<span className="text-brand-700">−{money(s.discount)}</span>} />}
            </div>
            {s.issues.length > 0 && (
              <ul className="mt-3 space-y-1">
                {s.issues.map((i, idx) => <li key={idx} className="flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{i}</li>)}
              </ul>
            )}
          </section>
        ))}
        {quote.isError && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{(quote.error as Error).message}</div>}

        {/* Promo */}
        <section className="card p-4">
          <h2 className="mb-2 font-bold">Promo code</h2>
          <div className="flex gap-2">
            <Input value={promoInput} onChange={(e) => setPromoInput(e.target.value.toUpperCase())} placeholder="e.g. WELCOME50" leftIcon={<Tag className="h-4 w-4" />} className="uppercase" />
            {promoCode ? <Button variant="outline" onClick={() => { setPromoCode(null); setPromoInput(''); }}>Remove</Button> : <Button variant="dark" onClick={() => promoInput && setPromoCode(promoInput.trim())} disabled={!promoInput}>Apply</Button>}
          </div>
          {q?.promo && <p className={cn('mt-2 flex items-center gap-1.5 text-xs font-medium', q.promo.valid && q.discount + (q.promo.type === 'FREE_DELIVERY' ? 1 : 0) > 0 ? 'text-brand-700' : 'text-rose-600')}>{q.promo.valid ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}{q.promo.message}{q.promo.valid && q.discount > 0 ? ` · you save ${money(q.discount)}` : ''}</p>}
          <div className="mt-2 flex flex-wrap gap-1.5">{['WELCOME50', 'FREESHIP'].map((c) => <button key={c} onClick={() => { setPromoInput(c); setPromoCode(c); }} className="rounded-md bg-slate-100 px-2 py-1 font-mono text-[11px] font-semibold text-slate-700">{c}</button>)}</div>
        </section>

        {/* Tip */}
        <section className="card p-4">
          <h2 className="font-bold">Tip your rider</h2>
          <p className="text-xs text-slate-500">100% goes to the rider{groups.length > 1 ? ', split between riders' : ''}.</p>
          <div className="mt-2 flex gap-2">{TIPS.map((t) => <Chip key={t} active={tip === t} onClick={() => setTip(t)}>{t === 0 ? 'No tip' : money(t)}</Chip>)}</div>
        </section>

        {/* Payment */}
        <section className="card p-4">
          <h2 className="mb-2 font-bold">Payment method</h2>
          <div className="space-y-2">
            {config.paymentMethods.map((m) => {
              const meta = PAYMENT_META[m];
              const active = payment === m;
              return (
                <button key={m} onClick={() => setPayment(m)} className={cn('flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition', active ? 'border-brand-600 bg-brand-50/60 ring-4 ring-brand-500/10' : 'border-slate-200 hover:border-slate-300')}>
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-white text-lg shadow-sm">{meta.emoji}</span>
                  <span className="flex-1">
                    <span className="block text-sm font-semibold">{meta.label}{m === 'WALLET' && <span className="ml-2 rounded bg-slate-100 px-1.5 text-[10px] font-bold text-slate-600">{user?.walletPoints ?? 0} pts</span>}</span>
                    <span className="block text-xs text-slate-500">{meta.hint}</span>
                  </span>
                  <span className={cn('h-5 w-5 rounded-full border-2', active ? 'border-brand-600 bg-brand-600 ring-2 ring-white ring-inset' : 'border-slate-300')} />
                </button>
              );
            })}
          </div>
          {walletShort && <p className="mt-2 text-xs text-rose-600">You need {q!.grandTotal} points but only have {user?.walletPoints}. Choose another method.</p>}
        </section>

        <section className="card p-4">
          <Field label="Order notes (optional)"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything else the shops or rider should know?" maxLength={300} className="min-h-[64px]" /></Field>
        </section>

        {q && (
          <section className="card p-4">
            <h2 className="mb-2 font-bold">Summary</h2>
            <div className="space-y-1.5">
              <Row label="Items" value={money(q.subtotal)} />
              <Row label={`Delivery (${q.shops.length} shop${q.shops.length > 1 ? 's' : ''})`} value={q.deliveryFee === 0 ? <span className="font-semibold text-brand-700">Free</span> : money(q.deliveryFee)} />
              <Row label="Service fee" value={money(q.serviceFee)} />
              {q.discount > 0 && <Row label="Discount" value={<span className="text-brand-700">−{money(q.discount)}</span>} />}
              {q.tip > 0 && <Row label="Rider tip" value={money(q.tip)} />}
              <Divider className="my-2" />
              <Row label="Total to pay" value={money(q.grandTotal)} strong className="text-base" />
              <p className="pt-1 text-[11px] text-slate-500">You'll earn about {Math.floor((q.subtotal * config.pointsRatePct) / 100)} loyalty points when delivered.</p>
            </div>
          </section>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md border-t border-slate-100 bg-white/95 p-4 backdrop-blur safe-bottom">
        <Button block size="xl" disabled={!canPlace} loading={place.isPending} onClick={() => place.mutate()} rightIcon={<ChevronRight className="h-5 w-5" />}>
          {q ? `Place order · ${money(q.grandTotal)}` : 'Place order'}
        </Button>
        {q && !q.ok && <p className="mt-2 text-center text-xs text-rose-600">Fix the issues above to continue.</p>}
      </div>

      <AddressSheet open={addrSheet} onClose={() => setAddrSheet(false)} addresses={addresses} selectedId={addressId} onSelect={(id) => { setAddressId(id); setAddrSheet(false); }} onCreated={async (a) => { await refetchAddresses(); setAddressId(a.id); setAddrSheet(false); }} initial={coords} />

      <AnimatePresence>
        {paying && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[1200] grid place-items-center bg-white/90 backdrop-blur">
            <div className="text-center">
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }} className="mx-auto grid h-16 w-16 place-items-center rounded-full border-4 border-brand-100 border-t-brand-600" />
              <div className="mt-4 font-bold">Processing {PAYMENT_META[payment].label} payment…</div>
              <div className="text-sm text-slate-500">Sandbox mode — no real money moves.</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function AddressSheet({ open, onClose, addresses, selectedId, onSelect, onCreated, initial }: { open: boolean; onClose: () => void; addresses: Address[]; selectedId: string | null; onSelect: (id: string) => void; onCreated: (a: Address) => void; initial: { lat: number; lng: number } }) {
  const [mode, setMode] = useState<'list' | 'new'>(addresses.length ? 'list' : 'new');
  useEffect(() => { if (open) setMode(addresses.length ? 'list' : 'new'); }, [open, addresses.length]);
  return (
    <Sheet open={open} onClose={onClose} title={mode === 'list' ? 'Delivery address' : 'New address'} size={mode === 'new' ? 'tall' : 'auto'}>
      {mode === 'list' ? (
        <div className="space-y-2 py-1">
          {addresses.map((a) => (
            <button key={a.id} onClick={() => onSelect(a.id)} className={cn('flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left', a.id === selectedId ? 'border-brand-600 bg-brand-50/50' : 'border-slate-200')}>
              <MapPin className="mt-0.5 h-4 w-4 text-brand-700" />
              <span className="min-w-0"><span className="block text-sm font-semibold">{a.label}</span><span className="block truncate text-xs text-slate-500">{[a.line1, a.area, a.city].filter(Boolean).join(', ')}</span></span>
            </button>
          ))}
          <Button variant="outline" block leftIcon={<Plus className="h-4 w-4" />} onClick={() => setMode('new')}>Add new address</Button>
        </div>
      ) : (
        <AddressForm initial={initial} onSaved={onCreated} onCancel={addresses.length ? () => setMode('list') : onClose} />
      )}
    </Sheet>
  );
}

export function AddressForm({ initial, onSaved, onCancel, existing }: { initial: { lat: number; lng: number }; onSaved: (a: Address) => void; onCancel?: () => void; existing?: Address }) {
  const [form, setForm] = useState({ label: existing?.label ?? 'Home', line1: existing?.line1 ?? '', area: existing?.area ?? '', city: existing?.city ?? 'Abbottabad', instructions: existing?.instructions ?? '', lat: existing?.lat ?? initial.lat, lng: existing?.lng ?? initial.lng, isDefault: existing?.isDefault ?? false });
  const [busy, setBusy] = useState(false);
  const onPick = (c: { lat: number; lng: number }, geo: GeoResult | null) => setForm((f) => ({ ...f, lat: c.lat, lng: c.lng, area: geo?.area && !existing ? geo.area : f.area || geo?.area || '', city: geo?.city ?? f.city }));
  const save = async () => {
    if (form.line1.trim().length < 3) return toast.error('Enter your house / street details');
    setBusy(true);
    try {
      const payload = { ...form, area: form.area || null, instructions: form.instructions || null } as Partial<Address> & DeliveryAddress;
      const a = existing ? await api.users.updateAddress(existing.id, payload) : await api.users.createAddress(payload);
      toast.success(existing ? 'Address updated' : 'Address saved');
      onSaved(a);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-3 py-1">
      <LocationPicker value={{ lat: form.lat, lng: form.lng }} onChange={onPick} height="h-56" />
      <div className="flex gap-2">{['Home', 'Office', 'Other'].map((l) => <Chip key={l} active={form.label === l} onClick={() => setForm((f) => ({ ...f, label: l }))}>{l === 'Home' ? '🏠' : l === 'Office' ? '🏢' : '📍'} {l}</Chip>)}</div>
      <Field label="House / street" required><Input value={form.line1} onChange={(e) => setForm((f) => ({ ...f, line1: e.target.value }))} placeholder="House 12, Street 4" /></Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Area"><Input value={form.area} onChange={(e) => setForm((f) => ({ ...f, area: e.target.value }))} placeholder="Jinnahabad" /></Field>
        <Field label="City"><Input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} /></Field>
      </div>
      <Field label="Instructions for rider"><Input value={form.instructions} onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))} placeholder="Green gate, ring twice" /></Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isDefault} onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))} className="h-4 w-4 accent-brand-600" /> Set as default address</label>
      <div className="flex gap-2 pt-1">
        {onCancel && <Button variant="outline" onClick={onCancel}>Back</Button>}
        <Button block loading={busy} onClick={save}>{existing ? 'Save changes' : 'Save address'}</Button>
      </div>
    </div>
  );
}
