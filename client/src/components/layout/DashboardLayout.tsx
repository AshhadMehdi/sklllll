import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LogOut, type LucideIcon } from 'lucide-react';
import { Avatar } from '@/components/ui';
import { NotificationBell } from '@/components/common/NotificationBell';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { useAuth } from '@/stores/auth';
import { disconnectSocket } from '@/lib/socket';
import { cn } from '@/lib/utils';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  badge?: number;
}

interface Props {
  items: NavItem[];
  title: string;
  subtitle?: string;
  accent?: string; // tailwind gradient classes for the brand block
  notificationsPath: string;
}

/** Responsive shell for merchant / runner / admin: sidebar on desktop, bottom tabs on mobile. */
export function DashboardLayout({ items, title, subtitle, accent = 'from-brand-600 to-brand-800', notificationsPath }: Props) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const doLogout = () => {
    logout();
    disconnectSocket();
    nav('/welcome');
  };
  const mobileItems = items.slice(0, 5);
  return (
    <div className="min-h-dvh bg-surface md:grid md:grid-cols-[248px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-slate-100 bg-white md:flex">
        <div className="p-5">
          <div className={cn('rounded-2xl bg-gradient-to-br p-4 text-white shadow-card', accent)}>
            <div className="flex items-center gap-2">
              <img src="/icons/icon-192.png" alt="" className="h-9 w-9 rounded-xl ring-2 ring-white/30" />
              <div>
                <div className="text-sm font-bold leading-tight">{title}</div>
                <div className="text-[11px] text-white/80">{subtitle}</div>
              </div>
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {items.map(({ to, label, icon: Icon, end, badge }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => cn('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition', isActive ? 'bg-brand-50 text-brand-800' : 'text-slate-600 hover:bg-slate-50 hover:text-ink')}>
              <Icon className="h-5 w-5" />
              <span className="flex-1">{label}</span>
              {badge ? <span className="rounded-full bg-accent-500 px-2 py-0.5 text-[11px] font-bold text-white">{badge}</span> : null}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-100 p-4">
          <div className="flex items-center gap-3">
            <Avatar name={user?.name ?? '?'} src={user?.avatarUrl} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{user?.name}</div>
              <div className="truncate text-xs text-slate-500">{user?.email}</div>
            </div>
            <button onClick={doLogout} className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Sign out">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-h-dvh flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-slate-100 bg-white/90 px-4 py-3 backdrop-blur md:hidden">
          <div className="flex items-center gap-2">
            <img src="/icons/icon-192.png" alt="" className="h-8 w-8 rounded-lg" />
            <div>
              <div className="text-sm font-bold leading-tight">{title}</div>
              <div className="text-[11px] text-slate-500">{user?.name}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <NotificationBell to={notificationsPath} />
            <button onClick={doLogout} className="grid h-10 w-10 place-items-center rounded-full bg-white text-slate-600 shadow-sm ring-1 ring-slate-100" aria-label="Sign out">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-4 md:px-8 md:pb-10 md:pt-6">
          <div className="mb-4 hidden justify-end gap-2 md:flex">
            <ThemeToggle />
            <NotificationBell to={notificationsPath} />
          </div>
          <Outlet />
        </main>
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-100 bg-white/95 backdrop-blur safe-bottom md:hidden">
          <div className="grid" style={{ gridTemplateColumns: `repeat(${mobileItems.length}, minmax(0, 1fr))` }}>
            {mobileItems.map(({ to, label, icon: Icon, end, badge }) => (
              <NavLink key={to} to={to} end={end} className={({ isActive }) => cn('relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium', isActive ? 'text-brand-700' : 'text-slate-500')}>
                <span className="relative">
                  <Icon className="h-6 w-6" />
                  {badge ? <span className="absolute -right-2.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-accent-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">{badge}</span> : null}
                </span>
                {label}
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}
