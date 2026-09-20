import { useEffect, useRef, useState } from 'react';
import { create } from 'zustand';
import { getSocket } from '@/lib/socket';
import { api } from '@/lib/api';
import { haversineKm, watchPosition } from '@/lib/geo';
import type { LatLng } from '@/lib/types';

interface GpsState {
  pos: LatLng | null;
  heading: number | null;
  error: string | null;
  simulated: boolean;
  set: (p: Partial<GpsState>) => void;
}
/** Latest known rider position — shared between the shell (which streams it) and pages (which draw it). */
export const useRunnerPosition = create<GpsState>()((set) => ({ pos: null, heading: null, error: null, simulated: false, set: (p) => set(p) }));

/** Publish a position to the server (socket first, REST fallback). */
export function publishPosition(p: LatLng, heading: number | null = null) {
  const s = getSocket();
  if (s?.connected) s.emit('runner:location', { lat: p.lat, lng: p.lng, heading });
  else api.runner.location(p.lat, p.lng).catch(() => {});
}

/**
 * Streams the device GPS to the server while `enabled`.
 * Throttled: a ping goes out at most every 4 s, and only if the rider moved ≥ 10 m (or 20 s passed).
 */
export function useRunnerGps(enabled: boolean) {
  const set = useRunnerPosition((s) => s.set);
  const simulated = useRunnerPosition((s) => s.simulated);
  const last = useRef<{ p: LatLng; t: number } | null>(null);
  const [supported] = useState(() => typeof navigator !== 'undefined' && 'geolocation' in navigator);

  useEffect(() => {
    if (!enabled || !supported || simulated) return;
    const stop = watchPosition(
      (p) => {
        const now = Date.now();
        set({ pos: { lat: p.lat, lng: p.lng }, heading: p.heading, error: null });
        const prev = last.current;
        const moved = prev ? haversineKm(prev.p, p) * 1000 : Infinity;
        if (!prev || (now - prev.t > 4000 && moved > 10) || now - prev.t > 20_000) {
          last.current = { p: { lat: p.lat, lng: p.lng }, t: now };
          publishPosition(p, p.heading);
        }
      },
      (e) => set({ error: e.code === 1 ? 'Location permission denied — enable it to receive nearby deliveries.' : 'Could not read GPS' }),
    );
    return stop;
  }, [enabled, supported, simulated, set]);

  return { supported };
}

/**
 * Demo helper: glide from A to B over `durationMs`, publishing positions as if the rider were moving.
 * Returns a stop function.
 */
export function simulateRide(from: LatLng, to: LatLng, durationMs = 60_000, onDone?: () => void) {
  const store = useRunnerPosition.getState();
  store.set({ simulated: true, pos: from });
  const t0 = Date.now();
  // Slight curve so it doesn't look like a laser beam
  const mid = { lat: (from.lat + to.lat) / 2 + (to.lng - from.lng) * 0.15, lng: (from.lng + to.lng) / 2 - (to.lat - from.lat) * 0.15 };
  const bez = (k: number) => ({ lat: (1 - k) ** 2 * from.lat + 2 * (1 - k) * k * mid.lat + k ** 2 * to.lat, lng: (1 - k) ** 2 * from.lng + 2 * (1 - k) * k * mid.lng + k ** 2 * to.lng });
  const timer = setInterval(() => {
    const k = Math.min(1, (Date.now() - t0) / durationMs);
    const p = bez(k);
    const ahead = bez(Math.min(1, k + 0.01));
    const heading = (Math.atan2(ahead.lng - p.lng, ahead.lat - p.lat) * 180) / Math.PI;
    useRunnerPosition.getState().set({ pos: p, heading });
    publishPosition(p, heading);
    if (k >= 1) {
      clearInterval(timer);
      useRunnerPosition.getState().set({ simulated: false });
      onDone?.();
    }
  }, 1500);
  return () => {
    clearInterval(timer);
    useRunnerPosition.getState().set({ simulated: false });
  };
}
