import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Bike, ShoppingBasket, Store } from 'lucide-react';
import { toast } from 'sonner';
import { AuthShell } from './AuthShell';
import { GoogleButton } from './GoogleButton';
import { Button, Divider, Field, Input, Select } from '@/components/ui';
import { api } from '@/lib/api';
import { homeForRole, useAuth } from '@/stores/auth';
import { useConfig } from '@/hooks/useConfig';
import { VEHICLES } from '@/lib/constants';
import { cn } from '@/lib/utils';

const roles = [
  { id: 'CUSTOMER', label: 'Customer', desc: 'Order from shops near me', icon: ShoppingBasket },
  { id: 'MERCHANT', label: 'Shop owner', desc: 'Sell & manage deliveries', icon: Store },
  { id: 'RUNNER', label: 'Rider', desc: 'Deliver & earn', icon: Bike },
] as const;

export default function Register() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const setSession = useAuth((s) => s.setSession);
  const { config } = useConfig();
  const [role, setRole] = useState<(typeof roles)[number]['id']>((params.get('role') as 'CUSTOMER') || 'CUSTOMER');
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', vehicleType: 'bike' });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const finish = (token: string, user: Parameters<typeof setSession>[1]) => {
    setSession(token, user);
    toast.success(`Welcome to Qareeb, ${user.name.split(' ')[0]}! 🎉`);
    nav(user.role === 'MERCHANT' ? '/merchant/setup' : homeForRole(user.role), { replace: true });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api.auth.register({ ...form, role, phone: form.phone || undefined, vehicleType: role === 'RUNNER' ? form.vehicleType : undefined });
      finish(r.token, r.user);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Create your account" subtitle="It takes less than a minute." footer={<>Already have an account? <Link to="/login" className="font-semibold text-brand-700">Sign in</Link></>}>
      <div className="mb-5 grid grid-cols-3 gap-2">
        {roles.map(({ id, label, desc, icon: Icon }) => (
          <button key={id} type="button" onClick={() => setRole(id)} className={cn('rounded-2xl border p-3 text-left transition', role === id ? 'border-brand-600 bg-brand-50 ring-4 ring-brand-500/15' : 'border-slate-200 hover:border-slate-300')}>
            <Icon className={cn('h-5 w-5', role === id ? 'text-brand-700' : 'text-slate-500')} />
            <div className="mt-2 text-sm font-bold">{label}</div>
            <div className="text-[11px] leading-tight text-slate-500">{desc}</div>
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Full name" required><Input required minLength={2} value={form.name} onChange={set('name')} placeholder="e.g. Ali Khan" /></Field>
        <Field label="Email" required><Input type="email" required value={form.email} onChange={set('email')} placeholder="you@example.com" /></Field>
        <Field label="Phone" hint="Riders and shops use this to reach you"><Input type="tel" value={form.phone} onChange={set('phone')} placeholder="+92 3xx xxxxxxx" /></Field>
        <Field label="Password" required><Input type="password" required minLength={6} value={form.password} onChange={set('password')} placeholder="At least 6 characters" /></Field>
        {role === 'RUNNER' && (
          <Field label="Vehicle">
            <Select value={form.vehicleType} onChange={set('vehicleType')}>
              {Object.entries(VEHICLES).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
            </Select>
          </Field>
        )}
        <Button type="submit" block size="lg" loading={busy}>
          {role === 'MERCHANT' ? 'Create account & set up shop' : role === 'RUNNER' ? 'Start riding' : 'Create account'}
        </Button>
      </form>
      {config.googleClientId && (
        <>
          <Divider label="or" className="my-5" />
          <GoogleButton onCredential={async (c) => { try { const r = await api.auth.google(c, role); finish(r.token, r.user); } catch (e) { toast.error((e as Error).message); } }} />
        </>
      )}
      <p className="mt-4 text-center text-[11px] text-slate-400">By continuing you agree to our Terms & Privacy Policy.</p>
    </AuthShell>
  );
}
