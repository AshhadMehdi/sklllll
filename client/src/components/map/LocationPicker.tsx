import { useEffect, useRef, useState } from 'react';
import { Marker, useMapEvents } from 'react-leaflet';
import type L from 'leaflet';
import { Crosshair, Loader2, MapPin, Search } from 'lucide-react';
import { toast } from 'sonner';
import { MapView, InvalidateOnMount } from './MapView';
import { meIcon, pinIcon } from './icons';
import { getCurrentPosition, reverseGeocode, searchPlaces, type GeoResult } from '@/lib/geo';
import type { LatLng } from '@/lib/types';
import { cn } from '@/lib/utils';

interface Props {
  value: LatLng;
  onChange: (coords: LatLng, geo: GeoResult | null) => void;
  className?: string;
  height?: string;
  showSearch?: boolean;
}

function DragTracker({ onMove }: { onMove: (c: LatLng) => void }) {
  useMapEvents({
    moveend: (e) => {
      const c = e.target.getCenter();
      onMove({ lat: c.lat, lng: c.lng });
    },
  });
  return null;
}

/** Map with a fixed center pin: pan the map to choose a spot. Reverse-geocodes on settle. */
export function LocationPicker({ value, onChange, className, height = 'h-64', showSearch = true }: Props) {
  const mapRef = useRef<L.Map | null>(null);
  const [me, setMe] = useState<LatLng | null>(null);
  const [locating, setLocating] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [label, setLabel] = useState<string>('');
  const [q, setQ] = useState('');
  const [results, setResults] = useState<GeoResult[]>([]);
  const settleTimer = useRef<number | undefined>(undefined);

  const settle = (c: LatLng) => {
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(async () => {
      setGeocoding(true);
      const geo = await reverseGeocode(c);
      setGeocoding(false);
      setLabel(geo?.short ?? `${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}`);
      onChange(c, geo);
    }, 350);
  };

  useEffect(() => {
    settle(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const locate = async () => {
    setLocating(true);
    try {
      const c = await getCurrentPosition();
      setMe(c);
      mapRef.current?.flyTo([c.lat, c.lng], 17, { duration: 0.8 });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLocating(false);
    }
  };

  useEffect(() => {
    if (!showSearch) return;
    const t = window.setTimeout(async () => setResults(q.length >= 3 ? await searchPlaces(q, value) : []), 400);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className={cn('space-y-2', className)}>
      {showSearch && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search area, street or landmark…" className="field pl-10" />
          {results.length > 0 && (
            <div className="absolute inset-x-0 top-full z-[500] mt-1 max-h-56 overflow-auto rounded-xl border border-slate-200 bg-white shadow-float">
              {results.map((r, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setQ('');
                    setResults([]);
                    mapRef.current?.flyTo([r.lat, r.lng], 17, { duration: 0.6 });
                  }}
                  className="flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm hover:bg-slate-50"
                >
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                  <span>
                    <span className="block font-medium">{r.short}</span>
                    <span className="block text-xs text-slate-500 line-clamp-1">{r.displayName}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <div className={cn('relative overflow-hidden rounded-2xl border border-slate-200', height)}>
        <MapView center={value} zoom={16} onReady={(m) => (mapRef.current = m)}>
          <InvalidateOnMount />
          <DragTracker onMove={settle} />
          {me && <Marker position={[me.lat, me.lng]} icon={meIcon} />}
        </MapView>
        {/* fixed centre pin */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-[400] -translate-x-1/2 -translate-y-full">
          <img alt="" src={`data:image/svg+xml;utf8,${encodeURIComponent(pinIcon.options.html as string)}`} className="h-[46px] w-[36px] drop-shadow-lg" />
        </div>
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-[399] h-2 w-4 -translate-x-1/2 rounded-[100%] bg-ink/30 blur-[1px]" />
        <button type="button" onClick={locate} className="absolute bottom-3 right-3 z-[400] grid h-10 w-10 place-items-center rounded-full bg-white text-brand-700 shadow-float hover:bg-brand-50" aria-label="Use my location">
          {locating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Crosshair className="h-5 w-5" />}
        </button>
      </div>
      <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
        <MapPin className="h-4 w-4 shrink-0 text-brand-600" />
        <span className="line-clamp-1 flex-1">{label || 'Move the map to set the pin'}</span>
        {geocoding && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
      </div>
    </div>
  );
}
