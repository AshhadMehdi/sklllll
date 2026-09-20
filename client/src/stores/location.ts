import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_CENTER } from '@/lib/constants';
import type { Address, LatLng } from '@/lib/types';

interface LocationState {
  coords: LatLng;
  label: string;
  source: 'default' | 'gps' | 'address' | 'manual';
  addressId: string | null;
  setFromGps: (coords: LatLng, label?: string) => void;
  setFromAddress: (a: Address) => void;
  setManual: (coords: LatLng, label: string) => void;
}

export const useLocation = create<LocationState>()(
  persist(
    (set) => ({
      coords: DEFAULT_CENTER,
      label: 'Abbottabad',
      source: 'default',
      addressId: null,
      setFromGps: (coords, label = 'Current location') => set({ coords, label, source: 'gps', addressId: null }),
      setFromAddress: (a) => set({ coords: { lat: a.lat, lng: a.lng }, label: `${a.label} · ${a.area || a.line1}`, source: 'address', addressId: a.id }),
      setManual: (coords, label) => set({ coords, label, source: 'manual', addressId: null }),
    }),
    { name: 'qareeb.location' },
  ),
);
