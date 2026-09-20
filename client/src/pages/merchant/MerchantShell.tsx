import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, ClipboardList, Package, Store, Bike, Ticket } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/stores/auth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageSpinner } from '@/components/ui';

export function MerchantShell() {
  const loc = useLocation();
  const setExtras = useAuth((s) => s.setExtras);
  const shopQ = useQuery({ queryKey: ['merchant', 'shop'], queryFn: api.merchant.shop, staleTime: 60_000 });
  const newOrders = useQuery({ queryKey: ['merchant', 'orders', 'new'], queryFn: () => api.merchant.orders('new'), enabled: !!shopQ.data, refetchInterval: 30_000 });
  useEffect(() => { if (shopQ.data) setExtras({ shop: { id: shopQ.data.id, name: shopQ.data.name, status: shopQ.data.status } }); }, [shopQ.data, setExtras]);

  if (shopQ.isLoading) return <PageSpinner label="Opening your shop…" />;
  if (shopQ.data === null) return <Navigate to="/merchant/setup" replace state={{ from: loc.pathname }} />;

  const items = [
    { to: '/merchant', label: 'Overview', icon: BarChart3, end: true },
    { to: '/merchant/orders', label: 'Orders', icon: ClipboardList, badge: newOrders.data?.length ?? 0 },
    { to: '/merchant/products', label: 'Products', icon: Package },
    { to: '/merchant/shop', label: 'Shop', icon: Store },
    { to: '/merchant/runners', label: 'Riders', icon: Bike },
    { to: '/merchant/promos', label: 'Promos', icon: Ticket },
  ];
  return <DashboardLayout items={items} title={shopQ.data?.name ?? 'My shop'} subtitle="Merchant dashboard" notificationsPath="/merchant/notifications" />;
}
