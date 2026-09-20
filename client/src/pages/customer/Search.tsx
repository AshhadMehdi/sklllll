import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Search as SearchIcon, X } from 'lucide-react';
import { api } from '@/lib/api';
import { useLocation } from '@/stores/location';
import { ShopCard, ShopCardSkeleton } from '@/components/shop/ShopCard';
import { Chip } from '@/components/ui';

const SUGGESTIONS = ['Atta', 'Chicken', 'Tomatoes', 'Milk', 'Panadol', 'Eggs', 'Bread', 'Rice', 'Dahi', 'Bananas', 'Cooking oil', 'Cake'];

export default function Search() {
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const { coords } = useLocation();
  const [text, setText] = useState(params.get('q') ?? '');
  const q = params.get('q') ?? '';
  useEffect(() => {
    const t = setTimeout(() => { if (text !== q) setParams(text ? { q: text } : {}, { replace: true }); }, 350);
    return () => clearTimeout(t);
  }, [text, q, setParams]);

  const res = useQuery({ queryKey: ['shops', 'search', coords, q], queryFn: () => api.shops.list({ lat: coords.lat, lng: coords.lng, radius: 20, q, limit: 40 }), enabled: q.length >= 2 });
  const recents: string[] = JSON.parse(localStorage.getItem('qareeb.recent') ?? '[]');
  useEffect(() => {
    if (q.length >= 2 && res.data) localStorage.setItem('qareeb.recent', JSON.stringify([q, ...recents.filter((r) => r !== q)].slice(0, 8)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [res.data]);

  return (
    <div className="min-h-dvh">
      <div className="sticky top-0 z-30 flex items-center gap-2 bg-surface/95 px-4 py-3 backdrop-blur">
        <button onClick={() => nav(-1)} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white shadow-sm ring-1 ring-slate-100"><ArrowLeft className="h-5 w-5" /></button>
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="Search products or shops" className="field pl-10 pr-9" />
          {text && <button onClick={() => setText('')} className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-slate-100 text-slate-500"><X className="h-3.5 w-3.5" /></button>}
        </div>
      </div>
      <div className="space-y-4 px-4 pb-6">
        {q.length < 2 ? (
          <>
            {recents.length > 0 && (
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Recent</div>
                <div className="flex flex-wrap gap-2">{recents.map((r) => <Chip key={r} onClick={() => setText(r)}>{r}</Chip>)}</div>
              </div>
            )}
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Popular searches</div>
              <div className="flex flex-wrap gap-2">{SUGGESTIONS.map((s) => <Chip key={s} onClick={() => setText(s)}>{s}</Chip>)}</div>
            </div>
          </>
        ) : (
          <>
            <div className="text-sm text-slate-500">{res.isLoading ? 'Searching…' : `${res.data?.total ?? 0} shops for “${q}”`}</div>
            {res.isLoading && [1, 2].map((i) => <ShopCardSkeleton key={i} />)}
            {res.data?.shops.map((s) => <ShopCard key={s.id} shop={s} />)}
            {res.data && res.data.shops.length === 0 && <div className="card p-8 text-center text-sm text-slate-500">Nothing found nearby for “{q}”. Try a different word.</div>}
          </>
        )}
      </div>
    </div>
  );
}
