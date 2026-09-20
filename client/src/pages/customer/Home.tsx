import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Search, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import { useLocation } from '@/stores/location';
import { useAuth } from '@/stores/auth';
import { useConfig } from '@/hooks/useConfig';
import { LocationBar } from '@/components/common/LocationBar';
import { NotificationBell } from '@/components/common/NotificationBell';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { ShopCard, ShopCardSkeleton } from '@/components/shop/ShopCard';
import { StatusBadge } from '@/components/order/StatusBadge';
import { SectionTitle, Skeleton } from '@/components/ui';
import { getCurrentPosition, reverseGeocode } from '@/lib/geo';
import { ACTIVE_STATUSES } from '@/lib/constants';
import { km, money } from '@/lib/utils';

export default function Home() {
  const nav = useNavigate();
  const { coords, source, setFromGps } = useLocation();
  const { user, token } = useAuth();
  const { config } = useConfig();

  // First visit: try to pick up GPS silently (no prompt spam if denied).
  useEffect(() => {
    if (source !== 'default') return;
    getCurrentPosition({ timeout: 6000, maximumAge: 60_000 })
      .then(async (c) => setFromGps(c, (await reverseGeocode(c))?.short ?? 'Current location'))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shopsQ = useQuery({ queryKey: ['shops', 'home', coords], queryFn: () => api.shops.list({ lat: coords.lat, lng: coords.lng, radius: 12, limit: 30 }) });
  const catsQ = useQuery({ queryKey: ['categories'], queryFn: api.shops.categories, staleTime: 5 * 60_000 });
  const featuredQ = useQuery({ queryKey: ['featured', coords], queryFn: () => api.shops.featured({ lat: coords.lat, lng: coords.lng }) });
  const ordersQ = useQuery({ queryKey: ['orders', 'active'], queryFn: () => api.orders.list('active'), enabled: !!token, refetchInterval: 30_000 });

  const active = (ordersQ.data ?? []).filter((o) => ACTIVE_STATUSES.includes(o.status));
  const shops = shopsQ.data?.shops ?? [];
  const topRated = [...shops].filter((s) => s.ratingCount > 0).sort((a, b) => b.ratingAvg - a.ratingAvg).slice(0, 8);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="pb-4">
      <div className="sticky top-0 z-30 bg-surface/95 px-4 pb-3 pt-4 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <LocationBar className="min-w-0 flex-1" />
          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle />
            {token ? <NotificationBell /> : <Link to="/login" className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white">Sign in</Link>}
          </div>
        </div>
        <button onClick={() => nav('/search')} className="mt-3 flex w-full items-center gap-2 rounded-2xl bg-white px-4 py-3 text-left text-sm text-slate-400 shadow-sm ring-1 ring-slate-100">
          <Search className="h-5 w-5" /> Search for atta, chicken, Panadol, tomatoes…
        </button>
      </div>

      <div className="space-y-6 px-4 pt-2">
        {user && <p className="text-sm text-slate-500">{greeting}, <span className="font-semibold text-ink">{user.name.split(' ')[0]}</span> 👋</p>}

        {active.length > 0 && (
          <section>
            <SectionTitle title="Your live orders" action={<Link to="/orders" className="text-sm font-semibold text-brand-700">All orders</Link>} />
            <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4">
              {active.map((o) => (
                <Link key={o.id} to={`/orders/${o.id}`} className="card w-72 shrink-0 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-bold">{o.shop.name}</span>
                    <StatusBadge status={o.status} />
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{o.items.length} items · {money(o.total)}</div>
                  <div className="mt-3 flex items-center gap-2 text-xs">
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-orange-50 text-base">{o.status === 'ON_THE_WAY' ? '🛵' : o.status === 'PENDING' ? '⏳' : '🧺'}</span>
                    <span className="flex-1 text-slate-600">{o.status === 'ON_THE_WAY' ? `${o.runner?.name ?? 'Rider'} is on the way` : o.status === 'PENDING' ? 'Waiting for the shop to accept' : 'Being prepared'} · ~{o.etaMinutes} min</span>
                    <ArrowRight className="h-4 w-4 text-slate-400" />
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section>
          <SectionTitle title="What do you need?" />
          <div className="no-scrollbar -mx-4 flex gap-2.5 overflow-x-auto px-4">
            {(catsQ.data ?? config.categories.map((c) => ({ ...c, count: 0 }))).filter((c) => c.count > 0 || !catsQ.data).map((c, i) => (
              <motion.button key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} onClick={() => nav(`/explore?category=${c.id}`)} className="flex w-[74px] shrink-0 flex-col items-center gap-1.5">
                <span className="grid h-16 w-16 place-items-center rounded-2xl bg-white text-3xl shadow-sm ring-1 ring-slate-100 transition hover:-translate-y-0.5 hover:shadow-card">{c.emoji}</span>
                <span className="text-center text-[11px] font-semibold leading-tight text-slate-700">{c.label}</span>
              </motion.button>
            ))}
          </div>
        </section>

        {(featuredQ.data?.length ?? 0) > 0 && (
          <section>
            <SectionTitle title="Popular near you" subtitle="Best sellers from nearby shops" />
            <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4">
              {featuredQ.data!.map((p) => (
                <Link key={p.id} to={`/shop/${p.shopId}`} className="card w-36 shrink-0 p-2.5">
                  <div className="grid h-20 place-items-center rounded-xl bg-slate-50 text-4xl">{p.emoji || '🛍️'}</div>
                  <div className="mt-2 line-clamp-2 text-[13px] font-semibold leading-snug">{p.name}</div>
                  <div className="text-[11px] text-slate-500">{p.shopName} · {km(p.distanceKm)}</div>
                  <div className="mt-1 text-sm font-bold">{money(p.price)} <span className="text-[11px] font-normal text-slate-400">/ {p.unit}</span></div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {topRated.length > 0 && (
          <section>
            <SectionTitle title="Top rated" action={<Link to="/explore?sort=rating" className="text-sm font-semibold text-brand-700">See all</Link>} />
            <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4">
              {topRated.map((s) => <ShopCard key={s.id} shop={s} compact />)}
            </div>
          </section>
        )}

        <section>
          <SectionTitle title={`Shops near ${shopsQ.data ? 'you' : '…'}`} subtitle={shopsQ.data ? `${shopsQ.data.total} shops within ${shopsQ.data.radiusKm} km` : undefined} action={<Link to="/explore" className="text-sm font-semibold text-brand-700">Map view</Link>} />
          <div className="space-y-3">
            {shopsQ.isLoading && [1, 2, 3].map((i) => <ShopCardSkeleton key={i} />)}
            {shops.map((s) => <ShopCard key={s.id} shop={s} />)}
            {shopsQ.data && shops.length === 0 && (
              <div className="card p-8 text-center">
                <div className="text-4xl">🗺️</div>
                <div className="mt-2 font-bold">No shops around here yet</div>
                <p className="text-sm text-slate-500">Try another location or widen your search on the map.</p>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-3xl bg-gradient-to-br from-ink to-slate-800 p-5 text-white">
          <div className="flex items-center gap-2 text-accent-400"><Sparkles className="h-4 w-4" /><span className="text-xs font-bold uppercase tracking-wide">Offer</span></div>
          <div className="mt-1 text-lg font-bold">Rs 50 off your first order</div>
          <p className="text-sm text-white/70">Use code <span className="rounded bg-white/15 px-1.5 py-0.5 font-mono text-white">WELCOME50</span> on orders above Rs 500 · <span className="font-mono text-white">FREESHIP</span> for free delivery above Rs 800.</p>
        </section>
        {!catsQ.data && <Skeleton className="h-4 w-1/2" />}
      </div>
    </div>
  );
}
