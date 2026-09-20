import { useState } from 'react';
import { ChevronDown, Crosshair, MapPin, Plus } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui';
import { LocationPicker } from '@/components/map/LocationPicker';
import { api } from '@/lib/api';
import { getCurrentPosition, reverseGeocode, type GeoResult } from '@/lib/geo';
import type { LatLng } from '@/lib/types';
import { useAuth } from '@/stores/auth';
import { useLocation } from '@/stores/location';
import { cn } from '@/lib/utils';

export function LocationBar({ className }: { className?: string }) {
  const { label, source } = useLocation();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className={cn('flex min-w-0 items-center gap-2 text-left', className)}>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-600 text-white shadow-sm shadow-brand-600/40">
          <MapPin className="h-5 w-5" />
        </span>
        <span className="min-w-0">
          <span className="block text-[11px] font-semibold uppercase tracking-wide text-brand-700">{source === 'gps' ? 'Current location' : source === 'address' ? 'Delivering to' : 'Showing shops near'}</span>
          <span className="flex items-center gap-1 text-sm font-semibold text-ink">
            <span className="truncate">{label}</span>
            <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
          </span>
        </span>
      </button>
      <LocationSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function LocationSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const token = useAuth((s) => s.token);
  const nav = useNavigate();
  const { coords, addressId, setFromGps, setFromAddress, setManual } = useLocation();
  const { data: addresses } = useQuery({ queryKey: ['addresses'], queryFn: api.users.addresses, enabled: !!token && open });
  const [mode, setMode] = useState<'list' | 'map'>('list');
  const [pick, setPick] = useState<{ coords: LatLng; geo: GeoResult | null }>({ coords, geo: null });
  const [locating, setLocating] = useState(false);

  const useGps = async () => {
    setLocating(true);
    try {
      const c = await getCurrentPosition();
      const geo = await reverseGeocode(c);
      setFromGps(c, geo?.short ?? 'Current location');
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLocating(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={mode === 'list' ? 'Where should we look?' : 'Pin your location'}>
      {mode === 'list' ? (
        <div className="space-y-3 pb-2">
          <button onClick={useGps} className="flex w-full items-center gap-3 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-left hover:bg-brand-100">
            <Crosshair className={cn('h-5 w-5 text-brand-700', locating && 'animate-spin')} />
            <span>
              <span className="block text-sm font-semibold text-brand-800">Use my current location</span>
              <span className="block text-xs text-brand-700/80">Uses GPS to find shops that deliver to you</span>
            </span>
          </button>
          <button onClick={() => setMode('map')} className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-left hover:bg-slate-50">
            <MapPin className="h-5 w-5 text-slate-600" />
            <span>
              <span className="block text-sm font-semibold">Choose on map</span>
              <span className="block text-xs text-slate-500">Drag the pin to any spot</span>
            </span>
          </button>
          {token && (
            <div>
              <div className="mb-2 mt-2 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Saved addresses</span>
                <button onClick={() => { onClose(); nav('/addresses?new=1'); }} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700">
                  <Plus className="h-3.5 w-3.5" /> Add new
                </button>
              </div>
              <div className="space-y-2">
                {addresses?.length === 0 && <p className="rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-500">No saved addresses yet.</p>}
                {addresses?.map((a) => (
                  <button key={a.id} onClick={() => { setFromAddress(a); onClose(); }} className={cn('flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left hover:bg-slate-50', addressId === a.id ? 'border-brand-500 bg-brand-50/40' : 'border-slate-200')}>
                    <span className="mt-0.5 text-lg">{a.label.toLowerCase().includes('office') || a.label.toLowerCase().includes('work') ? '🏢' : '🏠'}</span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">
                        {a.label} {a.isDefault && <span className="ml-1 rounded-full bg-slate-100 px-1.5 text-[10px] font-semibold text-slate-600">DEFAULT</span>}
                      </span>
                      <span className="block truncate text-xs text-slate-500">{[a.line1, a.area, a.city].filter(Boolean).join(', ')}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3 pb-2">
          <LocationPicker value={coords} onChange={(c, geo) => setPick({ coords: c, geo })} height="h-72" />
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setMode('list')}>Back</Button>
            <Button block onClick={() => { setManual(pick.coords, pick.geo?.short ?? 'Pinned location'); onClose(); setMode('list'); }}>
              Use this location
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
