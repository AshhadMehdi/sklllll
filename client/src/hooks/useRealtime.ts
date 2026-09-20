import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { getSocket, useSocketEvent } from '@/lib/socket';
import { useAuth } from '@/stores/auth';
import type { Notification, Order } from '@/lib/types';
import { playPing, vibrate } from '@/lib/utils';

/** App-wide realtime wiring: keeps React Query caches fresh and surfaces toasts. */
export function useRealtime() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const user = useAuth((s) => s.user);
  const token = useAuth((s) => s.token);

  useEffect(() => {
    if (token) getSocket();
  }, [token]);

  useSocketEvent<Notification>('notification', (n) => {
    qc.invalidateQueries({ queryKey: ['notifications'] });
    const url = n.data?.url as string | undefined;
    toast(n.title, { description: n.body, action: url ? { label: 'View', onClick: () => navigate(url) } : undefined, duration: 6000 });
    vibrate([30, 20, 30]);
    if (n.type === 'order' && user?.role === 'MERCHANT') playPing();
  });

  const refreshOrder = (o: Order) => {
    qc.setQueryData(['order', o.id], o);
    qc.invalidateQueries({ queryKey: ['orders'] });
    qc.invalidateQueries({ queryKey: ['merchant', 'orders'] });
    qc.invalidateQueries({ queryKey: ['merchant', 'analytics'] });
    qc.invalidateQueries({ queryKey: ['runner', 'deliveries'] });
    qc.invalidateQueries({ queryKey: ['admin', 'orders'] });
    qc.invalidateQueries({ queryKey: ['admin', 'stats'] });
    qc.invalidateQueries({ queryKey: ['wallet'] });
  };
  useSocketEvent<Order>('order:created', (o) => {
    refreshOrder(o);
    if (user?.role === 'MERCHANT') playPing();
  });
  useSocketEvent<Order>('order:updated', refreshOrder);
  useSocketEvent('shop:updated', () => qc.invalidateQueries({ queryKey: ['merchant', 'shop'] }));
}
