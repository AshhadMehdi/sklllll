import { useQuery } from '@tanstack/react-query';
import { ClipboardList, LayoutDashboard, Settings, Store, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { DashboardLayout } from '@/components/layout/DashboardLayout';

export function AdminShell() {
  const stats = useQuery({ queryKey: ['admin', 'stats'], queryFn: api.admin.stats, refetchInterval: 60_000 });
  const items = [
    { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
    { to: '/admin/shops', label: 'Shops', icon: Store, badge: stats.data?.shops.PENDING ?? 0 },
    { to: '/admin/users', label: 'Users', icon: Users },
    { to: '/admin/orders', label: 'Orders', icon: ClipboardList },
    { to: '/admin/settings', label: 'Settings', icon: Settings },
  ];
  return <DashboardLayout items={items} title="Qareeb Admin" subtitle="Platform console" accent="from-slate-700 to-slate-900" notificationsPath="/admin/notifications" />;
}
