import { useEffect, useRef, useState } from 'react';
import { Marker, Polyline, Popup } from 'react-leaflet';
import { FitBounds, InvalidateOnMount, MapView } from './MapView';
import { homeIcon, runnerIcon, shopIcon } from './icons';
import type { LatLng, Order } from '@/lib/types';
import { VEHICLES } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface Props {
  order: Order;
  runnerPos?: LatLng | null;
  className?: string;
  categoryEmoji?: string;
}

/** Linear interpolation between GPS pings so the rider glides instead of jumping. */
function useSmoothPosition(target: LatLng | null | undefined) {
  const [pos, setPos] = useState<LatLng | null>(target ?? null);
  const from = useRef<LatLng | null>(target ?? null);
  const raf = useRef<number | null>(null);
  useEffect(() => {
    if (!target) return;
    const start = from.current ?? target;
    const t0 = performance.now();
    const dur = 900;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      const cur = { lat: start.lat + (target.lat - start.lat) * e, lng: start.lng + (target.lng - start.lng) * e };
      setPos(cur);
      if (k < 1) raf.current = requestAnimationFrame(step);
      else from.current = target;
    };
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [target?.lat, target?.lng]); // eslint-disable-line react-hooks/exhaustive-deps
  return pos;
}

export function OrderTrackingMap({ order, runnerPos, className, categoryEmoji = '🏪' }: Props) {
  const shop = { lat: order.shop.lat, lng: order.shop.lng };
  const home = { lat: order.deliveryAddress.lat, lng: order.deliveryAddress.lng };
  const live = runnerPos ?? (order.runner?.lat != null && order.runner?.lng != null ? { lat: order.runner.lat, lng: order.runner.lng } : null);
  const smooth = useSmoothPosition(live);
  const showRunner = !!smooth && ['READY', 'ON_THE_WAY', 'ACCEPTED', 'PREPARING'].includes(order.status) && !!order.runnerId;
  const points = [shop, home, ...(showRunner && smooth ? [smooth] : [])];
  const vehicle = VEHICLES[order.runner?.vehicleType ?? 'bike']?.emoji ?? '🛵';
  const route: [number, number][] = order.status === 'ON_THE_WAY' && smooth ? [[shop.lat, shop.lng], [smooth.lat, smooth.lng], [home.lat, home.lng]] : [[shop.lat, shop.lng], [home.lat, home.lng]];

  return (
    <div className={cn('relative overflow-hidden', className)}>
      <MapView center={home} zoom={14}>
        <InvalidateOnMount />
        <FitBounds points={points} padding={56} />
        <Polyline positions={route} pathOptions={{ color: '#16a34a', weight: 4, opacity: 0.55, dashArray: order.status === 'ON_THE_WAY' ? undefined : '8 10' }} />
        <Marker position={[shop.lat, shop.lng]} icon={shopIcon(categoryEmoji)}>
          <Popup>
            <b>{order.shop.name}</b>
            <br />
            {order.shop.addressLine}
          </Popup>
        </Marker>
        <Marker position={[home.lat, home.lng]} icon={homeIcon}>
          <Popup>
            <b>{order.deliveryAddress.label}</b>
            <br />
            {order.deliveryAddress.line1}
          </Popup>
        </Marker>
        {showRunner && smooth && (
          <Marker position={[smooth.lat, smooth.lng]} icon={runnerIcon(vehicle)} zIndexOffset={1000}>
            <Popup>{order.runner?.name}</Popup>
          </Marker>
        )}
      </MapView>
    </div>
  );
}
