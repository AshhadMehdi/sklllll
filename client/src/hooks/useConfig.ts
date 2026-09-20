import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { AppConfig } from '@/lib/types';
import { DEFAULT_CENTER } from '@/lib/constants';

const FALLBACK: AppConfig = {
  appName: 'Qareeb',
  currency: 'PKR',
  city: { name: 'Abbottabad', ...DEFAULT_CENTER },
  serviceFee: 15,
  pointsRatePct: 2,
  customerCancelWindowMin: 5,
  categories: [],
  units: ['piece', 'kg', 'dozen', 'liter', 'pack'],
  paymentMethods: ['COD', 'JAZZCASH', 'EASYPAISA', 'CARD', 'WALLET'],
  googleClientId: null,
  vapidPublicKey: '',
  demo: null,
};

export function useConfig() {
  const q = useQuery({ queryKey: ['config'], queryFn: api.config, staleTime: 10 * 60_000 });
  return { config: q.data ?? FALLBACK, loading: q.isLoading };
}
