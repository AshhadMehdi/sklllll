import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Check, LogOut } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuth } from '@/stores/auth';
import { useLocation } from '@/stores/location';
import { disconnectSocket } from '@/lib/socket';
import { LocationPicker } from '@/components/map/LocationPicker';
import { Button, Field, Input } from '@/components/ui';
import { useConfig } from '@/hooks/useConfig';
import type { ShopHours } from '@/lib/types';
import { HoursEditor, ShopDetailsFields, detailsPayload, type DetailsState } from './ShopSettings';

const DEFAULT_HOURS: ShopHours = { mon: { open: '09:00', close: '21:00' }, tue: { open: '09:00', close: '21:00' }, wed: { open: '09:00', close: '21:00' }, thu: { open: '09:00', close: '21:00' }, fri: { open: '09:00', close: '21:00' }, sat: { open: '09:00', close: '21:00' }, sun: { open: '10:00', close: '20:00' } };

export default function MerchantSetup() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { config } = useConfig();
  const { user, logout } = useAuth();
  const { coords } = useLocation();
  const [step, setStep] = useState(0);
  const [f, setF] = useState<DetailsState>({ name: '', category: 'grocery', phone: user?.phone ?? '', description: '', tags: '', prepTimeMin: '15', minOrder: '200', logoUrl: null, coverUrl: null, addressLine: '', lat: coords.lat, lng: coords.lng });
  const [hours, setHours] = useState<ShopHours>(DEFAULT_HOURS);
  const [uploading, setUploading] = useState<string | null>(null);
  const set = <K extends keyof DetailsState>(k: K, v: DetailsState[K]) => setF((s) => ({ ...s, [k]: v }));
  const onUpload = async (kind: 'logoUrl' | 'coverUrl', file: File) => { setUploading(kind); try { const r = await api.upload(file); set(kind, r.url); } catch (e) { toast.error((e as Error).message); } finally { setUploading(null); } };

  const create = useMutation({
    mutationFn: () => api.merchant.createShop({ ...detailsPayload(f), hours }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['merchant'] }); toast.success('Your shop is live! Add products next.'); nav('/merchant/products', { replace: true }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const steps = ['About your shop', 'Location', 'Opening hours'];
  const canNext = step === 0 ? f.name.trim().length >= 2 : step === 1 ? f.addressLine.trim().length >= 3 : true;

  return (
    <div className="min-h-dvh bg-surface">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-100 bg-white/90 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2"><img src="/icons/icon-192.png" alt="" className="h-8 w-8 rounded-lg" /><div><div className="text-sm font-bold">Set up your shop</div><div className="text-[11px] text-slate-500">{user?.email}</div></div></div>
        <button onClick={() => { logout(); disconnectSocket(); nav('/welcome'); }} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500"><LogOut className="h-4 w-4" /> Sign out</button>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-6">
        <ol className="mb-6 flex items-center gap-2">
          {steps.map((s, i) => <li key={s} className="flex flex-1 items-center gap-2"><span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${i < step ? 'bg-brand-600 text-white' : i === step ? 'bg-ink text-white' : 'bg-slate-200 text-slate-500'}`}>{i < step ? <Check className="h-4 w-4" /> : i + 1}</span><span className={`hidden text-sm sm:block ${i === step ? 'font-bold' : 'text-slate-500'}`}>{s}</span>{i < steps.length - 1 && <span className="h-px flex-1 bg-slate-200" />}</li>)}
        </ol>
        <motion.div key={step} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} className="card p-5">
          {step === 0 && (<><h1 className="mb-1 text-xl font-extrabold">Tell customers about your shop</h1><p className="mb-5 text-sm text-slate-500">You can change all of this later from Shop settings.</p><ShopDetailsFields f={f} set={set} categories={config.categories} uploading={uploading} onUpload={onUpload} /></>)}
          {step === 1 && (<>
            <h1 className="mb-1 text-xl font-extrabold">Where is your shop?</h1><p className="mb-4 text-sm text-slate-500">Drag the map until the pin is on your door. Delivery fees and distances are calculated from this point.</p>
            <LocationPicker value={{ lat: f.lat, lng: f.lng }} onChange={(c, geo) => setF((s) => ({ ...s, lat: c.lat, lng: c.lng, addressLine: geo?.short ?? s.addressLine }))} height="h-72" />
            <Field label="Address line" required className="mt-3"><Input value={f.addressLine} onChange={(e) => set('addressLine', e.target.value)} placeholder="Shop 4, Main Bazaar, Abbottabad" /></Field>
            <p className="mt-2 text-xs text-slate-500">We'll start you with three delivery rings (2 km · Rs 60, 5 km · Rs 120, 8 km · Rs 200). Edit them any time.</p>
          </>)}
          {step === 2 && (<><h1 className="mb-1 text-xl font-extrabold">When are you open?</h1><p className="mb-4 text-sm text-slate-500">Customers only see you as "open" inside these hours. You can also pause the shop with one tap later.</p><HoursEditor hours={hours} onChange={setHours} /></>)}
          <div className="mt-6 flex items-center justify-between">
            <Button variant="ghost" leftIcon={<ArrowLeft className="h-4 w-4" />} disabled={step === 0} onClick={() => setStep((s) => s - 1)}>Back</Button>
            {step < 2 ? <Button rightIcon={<ArrowRight className="h-4 w-4" />} disabled={!canNext} onClick={() => setStep((s) => s + 1)}>Continue</Button> : <Button size="lg" loading={create.isPending} onClick={() => create.mutate()}>Open my shop 🎉</Button>}
          </div>
        </motion.div>
      </main>
    </div>
  );
}
