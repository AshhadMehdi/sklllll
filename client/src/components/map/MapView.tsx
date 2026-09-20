import { useEffect, type ReactNode } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { LatLng } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useTheme } from '@/stores/theme';

const TILE_URL = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
const TILE_URL_DARK = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

interface MapViewProps {
  center: LatLng;
  zoom?: number;
  className?: string;
  children?: ReactNode;
  interactive?: boolean;
  onReady?: (map: L.Map) => void;
}

export function MapView({ center, zoom = 14, className, children, interactive = true, onReady }: MapViewProps) {
  const isDark = useTheme((s) => s.isDark);
  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={zoom}
      zoomControl={false}
      attributionControl={true}
      scrollWheelZoom={interactive}
      dragging={interactive}
      doubleClickZoom={interactive}
      touchZoom={interactive}
      className={cn('h-full w-full', className)}
      ref={(m) => {
        if (m && onReady) onReady(m);
      }}
    >
      <TileLayer key={isDark ? 'dark' : 'light'} url={isDark ? TILE_URL_DARK : TILE_URL} attribution={ATTRIBUTION} maxZoom={19} />
      {children}
    </MapContainer>
  );
}

/** Smoothly re-center the map when `center` changes. */
export function Recenter({ center, zoom, animate = true }: { center: LatLng; zoom?: number; animate?: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (!center) return;
    if (animate) map.flyTo([center.lat, center.lng], zoom ?? map.getZoom(), { duration: 0.8 });
    else map.setView([center.lat, center.lng], zoom ?? map.getZoom());
  }, [center.lat, center.lng, zoom, animate, map]);
  return null;
}

/** Fit the map to a set of points (with padding). */
export function FitBounds({ points, padding = 48, maxZoom = 16 }: { points: LatLng[]; padding?: number; maxZoom?: number }) {
  const map = useMap();
  const key = points.map((p) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join('|');
  useEffect(() => {
    if (!points.length) return;
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], Math.min(maxZoom, 15));
      return;
    }
    map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng])), { padding: [padding, padding], maxZoom, animate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  return null;
}

/** Fix tiles not rendering when a map is mounted inside an animated/hidden container. */
export function InvalidateOnMount({ delay = 250 }: { delay?: number }) {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), delay);
    const t2 = setTimeout(() => map.invalidateSize(), delay * 3);
    return () => {
      clearTimeout(t);
      clearTimeout(t2);
    };
  }, [map, delay]);
  return null;
}
