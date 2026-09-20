import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatDistanceToNowStrict, format, isToday, isYesterday } from 'date-fns';

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export const money = (n: number | null | undefined, opts: { compact?: boolean } = {}) => {
  const v = Math.round(n ?? 0);
  if (opts.compact && Math.abs(v) >= 100_000) return `Rs ${(v / 1000).toFixed(0)}k`;
  return `Rs ${v.toLocaleString('en-PK')}`;
};

export const km = (n: number | null | undefined) => (n == null ? '—' : n < 1 ? `${Math.round(n * 1000)} m` : `${n.toFixed(1)} km`);

export const timeAgo = (iso: string | null | undefined) => (iso ? formatDistanceToNowStrict(new Date(iso), { addSuffix: true }) : '');

export const fmtTime = (iso: string | null | undefined) => (iso ? format(new Date(iso), 'h:mm a') : '');

export const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isToday(d)) return `Today, ${format(d, 'h:mm a')}`;
  if (isYesterday(d)) return `Yesterday, ${format(d, 'h:mm a')}`;
  return format(d, 'd MMM, h:mm a');
};

export const fmtShortDate = (iso: string) => format(new Date(iso), 'd MMM');

export const initials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

export const pluralize = (n: number, word: string, plural = `${word}s`) => `${n} ${n === 1 ? word : plural}`;

export const hoursLabel = (h: { open: string; close: string; closed?: boolean } | null | undefined) => {
  if (!h) return 'Hours not set';
  if (h.closed) return 'Closed today';
  const f = (t: string) => {
    const [hh, mm] = t.split(':').map(Number);
    const suffix = hh >= 12 ? 'PM' : 'AM';
    const h12 = hh % 12 === 0 ? 12 : hh % 12;
    return mm ? `${h12}:${String(mm).padStart(2, '0')} ${suffix}` : `${h12} ${suffix}`;
  };
  return `${f(h.open)} – ${f(h.close)}`;
};

export const telHref = (phone: string | null | undefined) => (phone ? `tel:${phone.replace(/[^+0-9]/g, '')}` : undefined);
export const waHref = (phone: string | null | undefined, text?: string) => {
  if (!phone) return undefined;
  const digits = phone.replace(/[^0-9]/g, '').replace(/^0/, '92');
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
};
export const mapsHref = (lat: number, lng: number) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

export const vibrate = (pattern: number | number[] = 12) => {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* noop */
  }
};

export const playPing = () => {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(880, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12);
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.4);
  } catch {
    /* noop */
  }
};
