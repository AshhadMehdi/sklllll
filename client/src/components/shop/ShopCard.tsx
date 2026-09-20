import { Link } from 'react-router-dom';
import { Clock, Heart, Star, Bike } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Shop } from '@/lib/types';
import { cn, km, money } from '@/lib/utils';
import { api } from '@/lib/api';
import { useAuth } from '@/stores/auth';

export function ShopCover({ shop, className }: { shop: Pick<Shop, 'coverUrl' | 'category' | 'name'>; className?: string }) {
  return <img src={shop.coverUrl || `/images/covers/${shop.category}.jpg`} onError={(e) => ((e.target as HTMLImageElement).src = '/images/covers/other.jpg')} alt={shop.name} className={cn('object-cover', className)} loading="lazy" />;
}

export function FavoriteButton({ shop, className }: { shop: Shop; className?: string }) {
  const qc = useQueryClient();
  const token = useAuth((s) => s.token);
  const m = useMutation({
    mutationFn: () => api.users.toggleFavorite(shop.id),
    onSuccess: (r) => {
      toast.success(r.favorite ? `Saved ${shop.name} to favourites` : `Removed from favourites`);
      qc.invalidateQueries({ queryKey: ['shops'] });
      qc.invalidateQueries({ queryKey: ['shop', shop.id] });
      qc.invalidateQueries({ queryKey: ['favorites'] });
    },
    onError: (e) => toast.error((e as Error).message),
  });
  if (!token) return null;
  return (
    <button
      aria-label="Toggle favourite"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        m.mutate();
      }}
      className={cn('grid h-9 w-9 place-items-center rounded-full bg-white/95 text-slate-600 shadow-sm backdrop-blur transition hover:scale-105', className)}
    >
      <Heart className={cn('h-4.5 w-4.5', shop.isFavorite && 'fill-rose-500 text-rose-500')} />
    </button>
  );
}

export function ShopCard({ shop, compact }: { shop: Shop; compact?: boolean }) {
  const closed = !shop.isOpenNow;
  if (compact) {
    return (
      <Link to={`/shop/${shop.slug}`} className="card flex w-40 shrink-0 flex-col overflow-hidden">
        <div className="relative h-24">
          <ShopCover shop={shop} className={cn('h-full w-full', closed && 'grayscale')} />
          {closed && <span className="absolute left-2 top-2 rounded-full bg-ink/80 px-2 py-0.5 text-[10px] font-bold text-white">Closed</span>}
        </div>
        <div className="p-2.5">
          <div className="truncate text-sm font-bold">{shop.name}</div>
          <div className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {shop.ratingAvg || 'New'} · {km(shop.distanceKm)}
          </div>
        </div>
      </Link>
    );
  }
  return (
    <Link to={`/shop/${shop.slug}`} className="card block overflow-hidden transition hover:shadow-float active:scale-[0.99]">
      <div className="relative h-36">
        <ShopCover shop={shop} className={cn('h-full w-full', closed && 'grayscale')} />
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/50 to-transparent" />
        <div className="absolute left-3 top-3 flex gap-1.5">
          <span className="rounded-full bg-white/95 px-2 py-0.5 text-[11px] font-semibold text-slate-700 backdrop-blur">{shop.categoryEmoji} {shop.categoryLabel}</span>
          {closed && <span className="rounded-full bg-ink/80 px-2 py-0.5 text-[11px] font-bold text-white">Closed{shop.opensAt ? ` · opens ${shop.opensAt}` : ''}</span>}
          {!shop.deliverable && !closed && <span className="rounded-full bg-rose-600/90 px-2 py-0.5 text-[11px] font-bold text-white">Out of range</span>}
        </div>
        <FavoriteButton shop={shop} className="absolute right-3 top-3" />
        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between text-white">
          <div className="min-w-0">
            <div className="truncate text-base font-bold drop-shadow">{shop.name}</div>
            <div className="truncate text-xs text-white/85">{shop.addressLine}</div>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 px-3.5 py-2.5 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1 font-semibold text-ink">
          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
          {shop.ratingAvg ? shop.ratingAvg.toFixed(1) : 'New'} {shop.ratingCount ? <span className="font-normal text-slate-400">({shop.ratingCount})</span> : null}
        </span>
        <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {shop.etaMinutes} min</span>
        <span className="inline-flex items-center gap-1"><Bike className="h-3.5 w-3.5" /> {shop.deliveryFee === 0 ? <span className="font-semibold text-brand-700">Free delivery</span> : money(shop.deliveryFee)}</span>
        <span className="ml-auto font-medium">{km(shop.distanceKm)}</span>
      </div>
      {shop.matchedProducts && shop.matchedProducts.length > 0 && (
        <div className="border-t border-slate-100 px-3.5 py-2 text-xs text-slate-600">
          Has: <span className="font-semibold text-ink">{shop.matchedProducts.join(', ')}</span>
        </div>
      )}
    </Link>
  );
}

export function ShopCardSkeleton() {
  return (
    <div className="card overflow-hidden">
      <div className="skeleton h-36 rounded-none" />
      <div className="flex gap-3 p-3.5">
        <div className="skeleton h-4 w-16" />
        <div className="skeleton h-4 w-14" />
        <div className="skeleton h-4 w-20" />
      </div>
    </div>
  );
}
