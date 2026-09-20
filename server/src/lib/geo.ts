import type { DeliveryZone, ShopHours } from '../db/schema.js';

const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance between two coordinates, in kilometres. */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

export const round1 = (n: number) => Math.round(n * 10) / 10;
export const round2 = (n: number) => Math.round(n * 100) / 100;

/** Bounding box helper for cheap SQL pre-filtering. */
export function boundingBox(lat: number, lng: number, radiusKm: number) {
  const dLat = radiusKm / 111.32;
  const dLng = radiusKm / (111.32 * Math.cos(toRad(lat)) || 1);
  return { minLat: lat - dLat, maxLat: lat + dLat, minLng: lng - dLng, maxLng: lng + dLng };
}

export interface ZoneMatch {
  zone: DeliveryZone | null;
  deliverable: boolean;
  fee: number;
  distanceKm: number;
  maxRadiusKm: number;
}

/**
 * Resolve which delivery zone (concentric ring) a distance falls into.
 * Zones are sorted by radius; the first ring whose radius >= distance wins.
 */
export function resolveZone(zones: DeliveryZone[], distanceKm: number, subtotal = 0): ZoneMatch {
  const sorted = [...zones].sort((a, b) => a.radiusKm - b.radiusKm);
  const maxRadiusKm = sorted.length ? sorted[sorted.length - 1].radiusKm : 0;
  const zone = sorted.find((z) => distanceKm <= z.radiusKm) ?? null;
  if (!zone) return { zone: null, deliverable: false, fee: 0, distanceKm: round2(distanceKm), maxRadiusKm };
  const free = zone.freeAbove != null && subtotal >= zone.freeAbove;
  return { zone, deliverable: true, fee: free ? 0 : zone.fee, distanceKm: round2(distanceKm), maxRadiusKm };
}

/** Rough urban ETA: prep time + travel at ~18 km/h + hand-off buffer. */
export function estimateEtaMinutes(prepTimeMin: number, distanceKm: number) {
  return Math.max(10, Math.round(prepTimeMin + (distanceKm / 18) * 60 + 6));
}

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

/** Check whether a shop is inside its opening hours right now (uses the given timezone offset in minutes, default Pakistan +05:00). */
export function isWithinHours(hours: ShopHours | null | undefined, now = new Date(), tzOffsetMin = 300): { open: boolean; today: ShopHours[keyof ShopHours] | null; opensAt?: string } {
  if (!hours) return { open: true, today: null };
  const local = new Date(now.getTime() + tzOffsetMin * 60_000);
  const key = DAY_KEYS[local.getUTCDay()];
  const today = hours[key];
  if (!today || today.closed) return { open: false, today: today ?? null };
  const minutes = local.getUTCHours() * 60 + local.getUTCMinutes();
  const [oh, om] = today.open.split(':').map(Number);
  const [ch, cm] = today.close.split(':').map(Number);
  const openM = oh * 60 + om;
  const closeM = ch * 60 + cm;
  const open = closeM > openM ? minutes >= openM && minutes < closeM : minutes >= openM || minutes < closeM; // supports past-midnight closing
  return { open, today, opensAt: open ? undefined : today.open };
}

export const DEFAULT_HOURS: ShopHours = {
  mon: { open: '08:00', close: '22:00' },
  tue: { open: '08:00', close: '22:00' },
  wed: { open: '08:00', close: '22:00' },
  thu: { open: '08:00', close: '22:00' },
  fri: { open: '08:00', close: '22:00' },
  sat: { open: '08:00', close: '22:00' },
  sun: { open: '09:00', close: '21:00' },
};
