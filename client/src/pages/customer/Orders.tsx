import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/layout/PageHeader';
import { OrderCard } from '@/components/order/OrderCard';
import { Tabs } from '@/components/ui/Tabs';
import { Button, EmptyState, Skeleton } from '@/components/ui';
import { NotificationBell } from '@/components/common/NotificationBell';

export default function Orders() {
  const nav = useNavigate();
  const [tab, setTab] = useState<'active' | 'past'>('active');
  const q = useQuery({ queryKey: ['orders', tab], queryFn: () => api.orders.list(tab), refetchInterval: tab === 'active' ? 20_000 : false });
  const activeCount = useQuery({ queryKey: ['orders', 'active'], queryFn: () => api.orders.list('active') }).data?.length ?? 0;
  return (
    <div className="min-h-dvh">
      <PageHeader title="My orders" back={false} action={<NotificationBell />} />
      <div className="px-4 pt-3">
        <Tabs tabs={[{ id: 'active', label: 'Active', count: activeCount }, { id: 'past', label: 'History' }]} value={tab} onChange={setTab} />
      </div>
      <div className="space-y-3 px-4 pt-4">
        {q.isLoading && [1, 2].map((i) => <Skeleton key={i} className="h-36" />)}
        {q.data?.map((o) => <OrderCard key={o.id} order={o} to={`/orders/${o.id}`} />)}
        {q.data?.length === 0 && (tab === 'active' ? <EmptyState emoji="🛵" title="No active orders" description="Hungry? Out of milk? Shops near you are ready." action={<Button onClick={() => nav('/home')}>Order something</Button>} /> : <EmptyState emoji="🧾" title="No past orders yet" />)}
      </div>
    </div>
  );
}
