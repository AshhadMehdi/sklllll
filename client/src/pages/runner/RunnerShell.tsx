import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bike, User, Wallet } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/stores/auth';
import { useRunnerGps } from '@/hooks/useRunnerGps';
import { DashboardLayout } from '@/components/layout/DashboardLayout';

export function RunnerShell() {
  const setExtras = useAuth((s) => s.setExtras);
  const profile = useQuery({ queryKey: ['runner', 'profile'], queryFn: api.runner.profile, staleTime: 30_000 });
  const active = useQuery({ queryKey: ['runner', 'deliveries', 'active'], queryFn: () => api.runner.deliveries('active'), refetchInterval: 30_000 });
  useEffect(() => { if (profile.data) setExtras({ runnerProfile: profile.data }); }, [profile.data, setExtras]);
  // Stream GPS whenever the rider is online or carrying something
  useRunnerGps(!!profile.data?.isAvailable || (active.data?.length ?? 0) > 0);
  const items = [
    { to: '/runner', label: 'Deliveries', icon: Bike, end: true, badge: active.data?.length ?? 0 },
    { to: '/runner/earnings', label: 'Earnings', icon: Wallet },
    { to: '/runner/profile', label: 'Profile', icon: User },
  ];
  return <DashboardLayout items={items} title="Qareeb Rider" subtitle={profile.data?.isAvailable ? '● Online' : '○ Offline'} accent="from-accent-500 to-accent-700" notificationsPath="/runner/notifications" />;
}
