import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Bike, Clock, Info, MapPin, Phone, Search, Share2, ShoppingBag, Star } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useLocation } from '@/stores/location';
import { selectCount, selectSubtotal, useCart } from '@/stores/cart';
import { FavoriteButton, ShopCover } from '@/components/shop/ShopCard';
import { ProductCard } from '@/components/shop/ProductCard';
import { Sheet } from '@/components/ui/Sheet';
import { Badge, PageSpinner, StarRating } from '@/components/ui';
import { DAY_KEYS, DAY_LABELS } from '@/lib/constants';
import { cn, hoursLabel, km, money, telHref, timeAgo } from '@/lib/utils';

export default function ShopPage() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const { coords } = useLocation();
  const cartCount = useCart(selectCount);
  const cartSubtotal = useCart(selectSubtotal);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string>('all');
  const [info, setInfo] = useState(false);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  const { data: shop, isLoading, error } = useQuery({ queryKey: ['shop', id, coords], queryFn: () => api.shops.get(id, { lat: coords.lat, lng: coords.lng }) });

  const filtered = useMemo(() => {
    if (!shop) return [];
    const term = q.trim().toLowerCase();
    return shop.products.filter((p) => (!term || p.name.toLowerCase().includes(term) || p.category.toLowerCase().includes(term)) && (cat === 'all' || p.category === cat));
  }, [shop, q, cat]);
  const grouped = useMemo(() => {
    const m = new Map<string, typeof filtered>();
    for (const p of filtered) m.set(p.category, [...(m.get(p.category) ?? []), p]);
    return [...m.entries()];
  }, [filtered]);

  useEffect(() => {
    if (error) toast.error((error as Error).message);
  }, [error]);

  if (isLoading) return <PageSpinner label="Loading shop…" />;
  if (!shop) return <div className="p-8 text-center text-sm text-slate-500">Shop not found.</div>;

  const closed = !shop.isOpenNow;
  const share = async () => {
    const url = window.location.href;
    if (navigator.share) await navigator.share({ title: shop.name, text: `Order from ${shop.name} on Qareeb`, url }).catch(() => {});
    else {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied');
    }
  };

  return (
    <div className="min-h-dvh pb-28">
      {/* Hero */}
      <div className="relative h-56">
        <ShopCover shop={shop} className={cn('h-full w-full', closed && 'grayscale')} />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60" />
        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4">
          <button onClick={() => (window.history.length > 1 ? nav(-1) : nav('/home'))} className="grid h-10 w-10 place-items-center rounded-full bg-white/95 text-ink shadow-sm backdrop-blur"><ArrowLeft className="h-5 w-5" /></button>
          <div className="flex gap-2">
            <button onClick={share} className="grid h-10 w-10 place-items-center rounded-full bg-white/95 text-ink shadow-sm backdrop-blur"><Share2 className="h-4 w-4" /></button>
            <FavoriteButton shop={shop} className="h-10 w-10" />
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 p-4 text-white">
          <div className="flex items-center gap-2">
            <Badge tone="brand" className="bg-white/95">{shop.categoryEmoji} {shop.categoryLabel}</Badge>
            {closed ? <Badge tone="rose" className="bg-rose-600 text-white">Closed{shop.opensAt ? ` · opens ${shop.opensAt}` : ''}</Badge> : <Badge className="bg-brand-600 text-white">Open now</Badge>}
          </div>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight drop-shadow">{shop.name}</h1>
          <div className="mt-1 flex items-center gap-1 text-xs text-white/90"><MapPin className="h-3.5 w-3.5" /> {shop.addressLine}</div>
        </div>
      </div>

      {/* Stats strip */}
      <div className="-mt-4 mx-4 grid grid-cols-4 divide-x divide-slate-100 rounded-2xl bg-white p-3 shadow-card">
        <button onClick={() => setInfo(true)} className="flex flex-col items-center gap-0.5">
          <span className="inline-flex items-center gap-1 text-sm font-bold"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />{shop.ratingAvg ? shop.ratingAvg.toFixed(1) : 'New'}</span>
          <span className="text-[10px] text-slate-500">{shop.ratingCount} reviews</span>
        </button>
        <div className="flex flex-col items-center gap-0.5">
          <span className="inline-flex items-center gap-1 text-sm font-bold"><Clock className="h-3.5 w-3.5 text-slate-500" />{shop.etaMinutes} min</span>
          <span className="text-[10px] text-slate-500">delivery</span>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <span className="inline-flex items-center gap-1 text-sm font-bold"><Bike className="h-3.5 w-3.5 text-slate-500" />{shop.deliveryFee === 0 ? 'Free' : money(shop.deliveryFee)}</span>
          <span className="text-[10px] text-slate-500">{km(shop.distanceKm)} away</span>
        </div>
        <button onClick={() => setInfo(true)} className="flex flex-col items-center gap-0.5">
          <span className="inline-flex items-center gap-1 text-sm font-bold"><Info className="h-3.5 w-3.5 text-slate-500" />Info</span>
          <span className="text-[10px] text-slate-500">hours & zones</span>
        </button>
      </div>

      {!shop.deliverable && (
        <div className="mx-4 mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <b>Outside delivery area.</b> This shop delivers up to {shop.maxRadiusKm} km — your location is {km(shop.distanceKm)} away. You can still browse, or change your location.
        </div>
      )}
      {shop.minOrder > 0 && <p className="mx-4 mt-3 text-xs text-slate-500">Minimum order {money(shop.minOrder)} · {shop.zoneName ? `${shop.zoneName} zone` : ''}{shop.zones.find((z) => z.freeAbove) ? ` · Free delivery above ${money(shop.zones.find((z) => z.freeAbove)!.freeAbove)}` : ''}</p>}

      {/* Search + categories (sticky) */}
      <div className="sticky top-0 z-30 mt-3 space-y-2 bg-surface/95 px-4 py-2 backdrop-blur">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search in ${shop.name}`} className="field bg-white pl-10" />
        </div>
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          {['all', ...shop.categories].map((c) => (
            <button key={c} onClick={() => { setCat(c); sectionRefs.current[c]?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }} className={cn('chip', cat === c ? 'border-ink bg-ink text-white' : 'border-slate-200 bg-white text-slate-700')}>
              {c === 'all' ? `All (${shop.products.length})` : c}
            </button>
          ))}
        </div>
      </div>

      {/* Products */}
      <div className="px-4">
        {grouped.length === 0 && <div className="py-12 text-center text-sm text-slate-500">No products match “{q}”.</div>}
        {grouped.map(([category, items]) => (
          <section key={category} ref={(el) => { sectionRefs.current[category] = el; }} className="scroll-mt-32 pt-4">
            <h2 className="mb-1 text-base font-bold">{category} <span className="text-sm font-normal text-slate-400">({items.length})</span></h2>
            <div className="card divide-y divide-slate-100 px-3">
              {items.map((p) => <ProductCard key={p.id} product={p} shopName={shop.name} disabled={closed} />)}
            </div>
          </section>
        ))}
      </div>

      {/* Cart bar */}
      {cartCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md p-4 safe-bottom">
          <Link to="/cart" className="flex items-center justify-between rounded-2xl bg-ink px-4 py-3.5 text-white shadow-float">
            <span className="flex items-center gap-3">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/15 text-sm font-bold">{cartCount}</span>
              <span className="text-sm font-semibold">View cart</span>
            </span>
            <span className="flex items-center gap-2 text-sm font-bold"><ShoppingBag className="h-4 w-4" />{money(cartSubtotal)}</span>
          </Link>
        </div>
      )}

      {/* Info sheet */}
      <Sheet open={info} onClose={() => setInfo(false)} title={shop.name}>
        <div className="space-y-5 py-1 text-sm">
          {shop.description && <p className="text-slate-600">{shop.description}</p>}
          <div className="grid grid-cols-2 gap-2">
            {shop.phone && <a href={telHref(shop.phone)} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 font-semibold text-ink"><Phone className="h-4 w-4 text-brand-700" /> Call shop</a>}
            <a href={`https://www.google.com/maps/search/?api=1&query=${shop.lat},${shop.lng}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 font-semibold text-ink"><MapPin className="h-4 w-4 text-brand-700" /> Directions</a>
          </div>
          <div>
            <h4 className="mb-2 font-bold">Opening hours</h4>
            <ul className="space-y-1 text-slate-600">
              {DAY_KEYS.map((d) => {
                const todayIdx = (new Date().getDay() + 6) % 7;
                const isToday = DAY_KEYS[todayIdx] === d;
                return (
                  <li key={d} className={cn('flex justify-between', isToday && 'font-semibold text-ink')}><span>{DAY_LABELS[d]}{isToday && ' (today)'}</span><span>{hoursLabel(shop.hours?.[d])}</span></li>
                );
              })}
            </ul>
          </div>
          <div>
            <h4 className="mb-2 font-bold">Delivery zones & fees</h4>
            <ul className="space-y-1.5">
              {shop.zones.map((z) => (
                <li key={z.id} className={cn('flex items-center justify-between rounded-xl px-3 py-2', shop.zoneName === z.name ? 'bg-brand-50 text-brand-800' : 'bg-slate-50 text-slate-600')}>
                  <span>{z.name} · up to {z.radiusKm} km{shop.zoneName === z.name && ' · you'}</span>
                  <span className="font-semibold">{money(z.fee)}{z.freeAbove ? <span className="ml-1 text-[11px] font-normal">(free above {money(z.freeAbove)})</span> : null}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-slate-500">Preparation time ~{shop.prepTimeMin} min · Min order {money(shop.minOrder)}</p>
          </div>
          <div>
            <h4 className="mb-2 font-bold">Reviews ({shop.ratingCount})</h4>
            {shop.reviews.length === 0 && <p className="text-slate-500">No reviews yet.</p>}
            <ul className="space-y-3">
              {shop.reviews.map((r) => (
                <li key={r.id} className="rounded-xl bg-slate-50 p-3">
                  <div className="flex items-center justify-between"><span className="font-semibold">{r.customerName}</span><StarRating value={r.shopRating} size="sm" /></div>
                  {r.comment && <p className="mt-1 text-slate-600">{r.comment}</p>}
                  <div className="mt-1 text-[11px] text-slate-400">{timeAgo(r.createdAt)}</div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Sheet>
    </div>
  );
}
