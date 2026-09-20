import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, ChevronRight, Heart, LogOut, MapPin, Palette, Pencil, Shield, Wallet, Store, Bike } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/stores/auth';
import { disconnectSocket } from '@/lib/socket';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/layout/PageHeader';
import { Avatar, Button, Field, Input, Switch } from '@/components/ui';
import { Sheet } from '@/components/ui/Sheet';
import { NotificationBell } from '@/components/common/NotificationBell';
import { ThemeSegment } from '@/components/common/ThemeToggle';
import { useConfig } from '@/hooks/useConfig';
import { disablePush, enablePush, getPushSubscription, pushSupported } from '@/lib/push';
import { useQueryClient } from '@tanstack/react-query';

export default function Profile() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { user, logout, setUser } = useAuth();
  const { config } = useConfig();
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({ name: user?.name ?? '', phone: user?.phone ?? '' });
  const [push, setPush] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => { getPushSubscription().then((s) => setPush(!!s)); }, []);
  if (!user) return null;

  const togglePush = async (v: boolean) => {
    setPushBusy(true);
    try {
      if (v) { const ok = await enablePush(config.vapidPublicKey); setPush(ok); if (!ok) toast.error('Notifications were not enabled'); else toast.success('Push notifications enabled'); }
      else { await disablePush(); setPush(false); }
    } catch (e) { toast.error((e as Error).message); } finally { setPushBusy(false); }
  };

  const save = async () => {
    try { const r = await api.users.updateMe({ name: form.name, phone: form.phone || null }); setUser(r.user); setEdit(false); toast.success('Profile updated'); } catch (e) { toast.error((e as Error).message); }
  };

  const items = [
    { to: '/addresses', icon: MapPin, label: 'Saved addresses', sub: 'Home, office and more' },
    { to: '/favorites', icon: Heart, label: 'Favourite shops' },
    { to: '/wallet', icon: Wallet, label: 'Qareeb points', sub: `${user.walletPoints} pts available` },
    { to: '/notifications', icon: Bell, label: 'Notifications' },
  ];

  return (
    <div className="min-h-dvh">
      <PageHeader title="Profile" back={false} action={<NotificationBell />} />
      <div className="space-y-4 px-4 pt-4">
        <section className="card flex items-center gap-4 p-4">
          <Avatar name={user.name} src={user.avatarUrl} size="xl" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-lg font-bold">{user.name}</div>
            <div className="truncate text-sm text-slate-500">{user.email}</div>
            <div className="text-sm text-slate-500">{user.phone || 'No phone added'}</div>
          </div>
          <button onClick={() => setEdit(true)} className="grid h-10 w-10 place-items-center rounded-full bg-slate-100"><Pencil className="h-4 w-4" /></button>
        </section>

        <section className="card divide-y divide-slate-100">
          {items.map(({ to, icon: Icon, label, sub }) => (
            <Link key={to} to={to} className="flex items-center gap-3 px-4 py-3.5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-700"><Icon className="h-4.5 w-4.5" /></span>
              <span className="flex-1"><span className="block text-sm font-semibold">{label}</span>{sub && <span className="block text-xs text-slate-500">{sub}</span>}</span>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </Link>
          ))}
          <div className="flex items-center gap-3 px-4 py-3.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-700"><Bell className="h-4.5 w-4.5" /></span>
            <span className="flex-1"><span className="block text-sm font-semibold">Push notifications</span><span className="block text-xs text-slate-500">{pushSupported() ? 'Order updates even when the app is closed' : 'Not supported in this browser'}</span></span>
            <Switch checked={push} onChange={togglePush} disabled={!pushSupported() || pushBusy} />
          </div>
          <div className="flex items-center gap-3 px-4 py-3.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-700"><Palette className="h-4.5 w-4.5" /></span>
            <span className="flex-1"><span className="block text-sm font-semibold">Appearance</span></span>
            <ThemeSegment className="w-52" />
          </div>
        </section>

        {(user.role === 'MERCHANT' || user.role === 'RUNNER' || user.role === 'ADMIN') && (
          <Link to={user.role === 'MERCHANT' ? '/merchant' : user.role === 'RUNNER' ? '/runner' : '/admin'} className="card flex items-center gap-3 p-4">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent-50 text-accent-700">{user.role === 'MERCHANT' ? <Store className="h-4.5 w-4.5" /> : user.role === 'RUNNER' ? <Bike className="h-4.5 w-4.5" /> : <Shield className="h-4.5 w-4.5" />}</span>
            <span className="flex-1 text-sm font-semibold">Open {user.role === 'MERCHANT' ? 'shop dashboard' : user.role === 'RUNNER' ? 'rider app' : 'admin console'}</span>
            <ChevronRight className="h-4 w-4 text-slate-400" />
          </Link>
        )}

        <Button variant="outline" block leftIcon={<LogOut className="h-4 w-4" />} onClick={() => { logout(); disconnectSocket(); qc.clear(); nav('/welcome'); }}>Sign out</Button>
        <p className="text-center text-[11px] text-slate-400">{config.appName} v1.0 · Made with 💚 in {config.city.name}</p>
      </div>

      <Sheet open={edit} onClose={() => setEdit(false)} title="Edit profile" footer={<Button block onClick={save}>Save</Button>}>
        <div className="space-y-3 py-1">
          <Field label="Name"><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></Field>
          <Field label="Phone" hint="Riders use this to call you"><Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+92 3xx xxxxxxx" /></Field>
        </div>
      </Sheet>
    </div>
  );
}
