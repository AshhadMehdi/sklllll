import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Marker, Popup, Circle } from 'react-leaflet';
import { List, Map as MapIcon, SlidersHorizontal, Star } from 'lucide-react';
import { api } from '@/lib/api';
import { useLocation } from '@/stores/location';
import { useConfig } from '@/hooks/useConfig';
import { MapView, Recenter, InvalidateOnMount } from '@/components/map/MapView';
import { meIcon, shopIcon } from '@/components/map/icons';
import { ShopCard, ShopCardSkeleton, ShopCover } from '@/components/shop/ShopCard';
import { LocationBar } from '@/components/common/LocationBar';
import { Chip, Switch } from '@/components/ui';
import { Sheet } from '@/components/ui/Sheet';
import { cn, km, money } from '@/lib/utils';

export default function Explore() {
  const [params, setParams] = useSearchParams();
  const { coords } = useLocation();
  const { config } = useConfig();
  const category = params.get('category') ?? 'all';
  const sort = params.get('sort') ?? 'distance';
  const openNow = params.get('open') === '1';
  const [view, setView] = useState<'map' | 'list'>((params.get('view') as 'list') || 'map');
  const [radius, setRadius] = useState(8);
  const [selected, setSelected] = useState<string | null>(null);
  const [filters, setFilters] = useState(false);

  const set = (k: string, v: string | null) => {
    const p = new URLSearchParams(params);
    if (v == null || v === 'all' || v === '') p.delete(k);
    else p.set(k, v);
    setParams(p, { replace: true });
  };

  const q = useQuery({ queryKey: ['shops', 'explore', coords, category, sort, openNow, radius], queryFn: () => api.shops.list({ lat: coords.lat, lng: coords.lng, radius, category, sort, openNow, limit: 80 }) });
  const shops = q.data?.shops ?? [];
  const sel = useMemo(() => shops.find((s) => s.id === selected) ?? null, [shops, selected]);
  const cats = [{ id: 'all', label: 'All', emoji: '✨' }, ...config.categories];

  return (
    <div className="relative flex h-dvh flex-col">
      <div className="z-30 space-y-3 bg-surface/95 px-4 pb-3 pt-4 backdrop-blur">
        <div className="flex items-center gap-2">
          <LocationBar className="min-w-0 flex-1" />
          <div className="flex rounded-xl bg-white p-1 shadow-sm ring-1 ring-slate-100">
            <button onClick={() => setView('map')} className={cn('grid h-8 w-9 place-items-center rounded-lg', view === 'map' && 'bg-ink text-white')}><MapIcon className="h-4 w-4" /></button>
            <button onClick={() => setView('list')} className={cn('grid h-8 w-9 place-items-center rounded-lg', view === 'list' && 'bg-ink text-white')}><List className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          <Chip onClick={() => setFilters(true)} className="border-slate-200 bg-white"><SlidersHorizontal className="h-3.5 w-3.5" /> Filters{(openNow || sort !== 'distance') && <span className="ml-1 h-1.5 w-1.5 rounded-full bg-accent-500" />}</Chip>
          {cats.map((c) => (
            <Chip key={c.id} active={category === c.id} onClick={() => set('category', c.id)}>
              {c.emoji} {c.label}
            </Chip>
          ))}
        </div>
      </div>

      {view === 'map' ? (
        <div className="relative flex-1">
          <MapView center={coords} zoom={14} className="absolute inset-0">
            <InvalidateOnMount />
            <Recenter center={coords} />
            <Marker position={[coords.lat, coords.lng]} icon={meIcon} />
            <Circle center={[coords.lat, coords.lng]} radius={radius * 1000} pathOptions={{ color: '#16a34a', weight: 1, fillOpacity: 0.04, dashArray: '6 6' }} />
            {shops.map((s) => (
              <Marker key={s.id} position={[s.lat, s.lng]} icon={shopIcon(s.categoryEmoji, { closed: !s.isOpenNow, selected: s.id === selected })} eventHandlers={{ click: () => setSelected(s.id) }}>
                <Popup>
                  <b>{s.name}</b>
                  <br />
                  {km(s.distanceKm)} · {s.isOpenNow ? 'Open' : 'Closed'}
                </Popup>
              </Marker>
            ))}
          </MapView>
          <div className="pointer-events-none absolute inset-x-0 top-3 z-[400] flex justify-center">
            <span className="rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">{q.isLoading ? 'Finding shops…' : `${shops.length} shops within ${radius} km`}</span>
          </div>
          <div className="absolute inset-x-0 bottom-0 z-[400] pb-[calc(5.25rem+env(safe-area-inset-bottom))]">
            <div className="no-scrollbar flex snap-x gap-3 overflow-x-auto px-4 pb-2" onScroll={(e) => {
              const el = e.currentTarget;
              const i = Math.round(el.scrollLeft / 292);
              if (shops[i] && shops[i].id !== selected) setSelected(shops[i].id);
            }}>
              {shops.map((s) => (
                <Link key={s.id} to={`/shop/${s.slug}`} className={cn('card flex w-[280px] shrink-0 snap-center gap-3 p-3', sel?.id === s.id && 'ring-2 ring-accent-500')}>
                  <ShopCover shop={s} className="h-20 w-20 shrink-0 rounded-xl" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold">{s.name}</div>
                    <div className="text-[11px] text-slate-500">{s.categoryEmoji} {s.categoryLabel} · {km(s.distanceKm)}</div>
                    <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-600"><Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {s.ratingAvg || 'New'} · {s.etaMinutes} min · {s.deliveryFee ? money(s.deliveryFee) : 'Free'}</div>
                    <div className="mt-1">{s.isOpenNow ? <span className="text-[11px] font-semibold text-brand-700">Open now</span> : <span className="text-[11px] font-semibold text-slate-400">Closed{s.opensAt ? ` · opens ${s.opensAt}` : ''}</span>}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 space-y-3 overflow-y-auto px-4 pb-safe-nav pt-1">
          {q.isLoading && [1, 2, 3].map((i) => <ShopCardSkeleton key={i} />)}
          {shops.map((s) => <ShopCard key={s.id} shop={s} />)}
          {q.data && shops.length === 0 && <div className="card p-8 text-center text-sm text-slate-500">No shops match these filters.</div>}
        </div>
      )}

      <Sheet open={filters} onClose={() => setFilters(false)} title="Filters">
        <div className="space-y-5 py-1">
          <div>
            <div className="mb-2 text-sm font-semibold">Sort by</div>
            <div className="flex flex-wrap gap-2">
              {[['distance', 'Nearest'], ['rating', 'Top rated'], ['fee', 'Lowest delivery fee'], ['eta', 'Fastest']].map(([id, label]) => (
                <Chip key={id} active={sort === id} onClick={() => set('sort', id)}>{label}</Chip>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">Open now only</div>
              <div className="text-xs text-slate-500">Hide shops that are closed</div>
            </div>
            <Switch checked={openNow} onChange={(v) => set('open', v ? '1' : null)} />
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between text-sm font-semibold"><span>Search radius</span><span className="text-brand-700">{radius} km</span></div>
            <input type="range" min={1} max={20} value={radius} onChange={(e) => setRadius(Number(e.target.value))} className="w-full accent-brand-600" />
          </div>
        </div>
      </Sheet>
    </div>
  );
}
