import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { AuthShell } from './AuthShell';
import { GoogleButton } from './GoogleButton';
import { Button, Divider, Field, Input } from '@/components/ui';
import { api } from '@/lib/api';
import { homeForRole, useAuth } from '@/stores/auth';
import { useConfig } from '@/hooks/useConfig';

export default function Login() {
  const nav = useNavigate();
  const loc = useLocation() as { state?: { from?: string } };
  const setSession = useAuth((s) => s.setSession);
  const { config } = useConfig();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  const finish = (token: string, user: Parameters<typeof setSession>[1]) => {
    setSession(token, user);
    toast.success(`Welcome back, ${user.name.split(' ')[0]}!`);
    nav(loc.state?.from && user.role === 'CUSTOMER' ? loc.state.from : homeForRole(user.role), { replace: true });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api.auth.login(email, password);
      finish(r.token, r.user);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to order, manage your shop or deliver." footer={<>New here? <Link to="/register" className="font-semibold text-brand-700">Create an account</Link></>}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email">
          <Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" leftIcon={<Mail className="h-4 w-4" />} />
        </Field>
        <Field label="Password">
          <Input type={show ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" leftIcon={<Lock className="h-4 w-4" />} rightSlot={<button type="button" onClick={() => setShow((v) => !v)} className="grid h-8 w-8 place-items-center text-slate-400">{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>} />
        </Field>
        <Button type="submit" block size="lg" loading={busy}>Sign in</Button>
      </form>
      <GoogleWrap onCredential={async (c) => { try { const r = await api.auth.google(c); finish(r.token, r.user); } catch (e) { toast.error((e as Error).message); } }} />
      {config.demo && (
        <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-xs text-slate-600">
          <div className="mb-2 font-semibold text-slate-700">Demo accounts (password: {config.demo.password})</div>
          <div className="grid grid-cols-2 gap-1.5">
            {[['Customer', 'ali@demo.com'], ['Shop owner', 'madina@demo.com'], ['Rider', 'rider1@demo.com'], ['Admin', 'admin@qareeb.app']].map(([r, e]) => (
              <button key={e} type="button" onClick={() => { setEmail(e); setPassword(config.demo!.password); }} className="rounded-lg bg-white px-2 py-1.5 text-left ring-1 ring-slate-200 hover:ring-brand-400">
                <span className="block font-semibold">{r}</span>
                <span className="block truncate text-[11px] text-slate-500">{e}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </AuthShell>
  );
}

function GoogleWrap({ onCredential }: { onCredential: (c: string) => void }) {
  const { config } = useConfig();
  if (!config.googleClientId) return null;
  return (
    <>
      <Divider label="or" className="my-5" />
      <GoogleButton onCredential={onCredential} />
    </>
  );
}
