import type { LatLng } from './types';

export function getCurrentPosition(opts: PositionOptions = { enableHighAccuracy: true, timeout: 8000, maximumAge: 30_000 }): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('Geolocation is not supported on this device'));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(new Error(err.code === 1 ? 'Location permission denied' : 'Could not get your location')),
      opts,
    );
  });
}

export function watchPosition(cb: (p: LatLng & { heading: number | null; accuracy: number }) => void, onError?: (e: GeolocationPositionError) => void) {
  if (!('geolocation' in navigator)) return () => {};
  const id = navigator.geolocation.watchPosition((pos) => cb({ lat: pos.coords.latitude, lng: pos.coords.longitude, heading: pos.coords.heading, accuracy: pos.coords.accuracy }), onError, { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 });
  return () => navigator.geolocation.clearWatch(id);
}

const toRad = (d: number) => (d * Math.PI) / 180;
export function haversineKm(a: LatLng, b: LatLng) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(x)));
}

export interface GeoResult {
  displayName: string;
  short: string;
  area: string | null;
  city: string | null;
  lat: number;
  lng: number;
}

const NOMINATIM = 'https://nominatim.openstreetmap.org';
const cache = new Map<string, GeoResult | null>();

function toResult(j: { display_name?: string; lat: string; lon: string; address?: Record<string, string>; name?: string }): GeoResult {
  const a = j.address ?? {};
  const area = a.suburb || a.neighbourhood || a.quarter || a.residential || a.village || a.hamlet || a.road || null;
  const city = a.city || a.town || a.county || a.state_district || a.state || null;
  const road = [a.house_number, a.road].filter(Boolean).join(' ');
  const short = [road || j.name, area, city].filter(Boolean).filter((v, i, arr) => arr.indexOf(v) === i).join(', ') || j.display_name || '';
  return { displayName: j.display_name ?? short, short, area, city, lat: Number(j.lat), lng: Number(j.lon) };
}

/** Reverse-geocode with OpenStreetMap Nominatim (called from the browser; fails gracefully offline). */
export async function reverseGeocode(p: LatLng): Promise<GeoResult | null> {
  const key = `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`;
  if (cache.has(key)) return cache.get(key)!;
  try {
    const res = await fetch(`${NOMINATIM}/reverse?format=jsonv2&lat=${p.lat}&lon=${p.lng}&zoom=17&addressdetails=1`, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error('geocode failed');
    const j = await res.json();
    const r = j?.lat ? toResult(j) : null;
    cache.set(key, r);
    return r;
  } catch {
    cache.set(key, null);
    return null;
  }
}

export async function searchPlaces(q: string, near: LatLng): Promise<GeoResult[]> {
  if (!q.trim()) return [];
  try {
    const box = [near.lng - 0.35, near.lat + 0.35, near.lng + 0.35, near.lat - 0.35].join(',');
    const res = await fetch(`${NOMINATIM}/search?format=jsonv2&q=${encodeURIComponent(q)}&addressdetails=1&limit=6&viewbox=${box}&bounded=0&countrycodes=pk`, { headers: { Accept: 'application/json' } });
    if (!res.ok) return [];
    const list = (await res.json()) as Parameters<typeof toResult>[0][];
    return list.map(toResult);
  } catch {
    return [];
  }
}
