import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { useLocation } from '@/stores/location';
import { PageHeader } from '@/components/layout/PageHeader';
import { ShopCard, ShopCardSkeleton } from '@/components/shop/ShopCard';
import { Button, EmptyState } from '@/components/ui';

export default function Favorites() {
  const nav = useNavigate();
  const { coords } = useLocation();
  const favs = useQuery({ queryKey: ['favorites'], queryFn: api.users.favorites });
  // Re-fetch decorated shop data (distance, open state) for the favourites
  const shops = useQuery({ queryKey: ['shops', 'favs', coords, favs.data?.map((s) => s.id)], queryFn: () => api.shops.list({ lat: coords.lat, lng: coords.lng, radius: 50, limit: 200 }), enabled: !!favs.data?.length });
  const ids = new Set(favs.data?.map((s) => s.id));
  const list = (shops.data?.shops ?? []).filter((s) => ids.has(s.id));
  return (
    <div className="min-h-dvh">
      <PageHeader title="Favourite shops" back="/profile" />
      <div className="space-y-3 px-4 pt-4">
        {(favs.isLoading || (favs.data?.length && shops.isLoading)) && [1, 2].map((i) => <ShopCardSkeleton key={i} />)}
        {favs.data?.length === 0 && <EmptyState emoji="💚" title="No favourites yet" description="Tap the heart on any shop to keep it here." action={<Button onClick={() => nav('/home')}>Browse shops</Button>} />}
        {list.map((s) => <ShopCard key={s.id} shop={{ ...s, isFavorite: true }} />)}
      </div>
    </div>
  );
}
