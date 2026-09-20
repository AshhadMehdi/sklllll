import { Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/stores/auth';
import { cn } from '@/lib/utils';

export function NotificationBell({ to = '/notifications', className }: { to?: string; className?: string }) {
  const token = useAuth((s) => s.token);
  const { data } = useQuery({ queryKey: ['notifications'], queryFn: api.users.notifications, enabled: !!token, refetchInterval: 60_000 });
  const unread = data?.unread ?? 0;
  return (
    <Link to={to} aria-label="Notifications" className={cn('relative grid h-10 w-10 place-items-center rounded-full bg-white text-slate-700 shadow-sm ring-1 ring-slate-100 hover:bg-slate-50', className)}>
      <Bell className="h-5 w-5" />
      {unread > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-accent-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">{unread > 9 ? '9+' : unread}</span>}
    </Link>
  );
}
