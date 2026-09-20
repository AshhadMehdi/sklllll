import type { OrderStatus, PaymentMethod } from './types';

export const APP_NAME = 'Qareeb';
export const TAGLINE = 'Local shops, delivered';

export const STATUS_META: Record<OrderStatus, { label: string; short: string; color: string; dot: string; emoji: string; description: string }> = {
  PENDING: { label: 'Waiting for shop', short: 'Pending', color: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500', emoji: '⏳', description: 'The shop will confirm your order shortly.' },
  ACCEPTED: { label: 'Accepted', short: 'Accepted', color: 'bg-sky-50 text-sky-700 border-sky-200', dot: 'bg-sky-500', emoji: '✅', description: 'The shop accepted your order.' },
  PREPARING: { label: 'Being prepared', short: 'Preparing', color: 'bg-indigo-50 text-indigo-700 border-indigo-200', dot: 'bg-indigo-500', emoji: '🧺', description: 'Your items are being packed.' },
  READY: { label: 'Ready for pickup', short: 'Ready', color: 'bg-violet-50 text-violet-700 border-violet-200', dot: 'bg-violet-500', emoji: '📦', description: 'Packed and waiting for the rider.' },
  ON_THE_WAY: { label: 'On the way', short: 'On the way', color: 'bg-orange-50 text-orange-700 border-orange-200', dot: 'bg-orange-500', emoji: '🛵', description: 'Your rider is heading to you.' },
  DELIVERED: { label: 'Delivered', short: 'Delivered', color: 'bg-brand-50 text-brand-700 border-brand-200', dot: 'bg-brand-600', emoji: '🎉', description: 'Enjoy your order!' },
  CANCELLED: { label: 'Cancelled', short: 'Cancelled', color: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500', emoji: '❌', description: 'This order was cancelled.' },
};

export const STATUS_FLOW: OrderStatus[] = ['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'ON_THE_WAY', 'DELIVERED'];
export const ACTIVE_STATUSES: OrderStatus[] = ['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'ON_THE_WAY'];

export const PAYMENT_META: Record<PaymentMethod, { label: string; hint: string; emoji: string }> = {
  COD: { label: 'Cash on delivery', hint: 'Pay the rider when your order arrives', emoji: '💵' },
  JAZZCASH: { label: 'JazzCash', hint: 'Mobile wallet · sandbox payment', emoji: '📱' },
  EASYPAISA: { label: 'Easypaisa', hint: 'Mobile wallet · sandbox payment', emoji: '📲' },
  CARD: { label: 'Debit / credit card', hint: 'Visa, Mastercard · sandbox payment', emoji: '💳' },
  WALLET: { label: 'Qareeb points', hint: 'Use your loyalty points (1 pt = Rs 1)', emoji: '🪙' },
};

export const VEHICLES: Record<string, { label: string; emoji: string }> = {
  bike: { label: 'Motorbike', emoji: '🏍️' },
  scooter: { label: 'Scooter', emoji: '🛵' },
  car: { label: 'Car', emoji: '🚗' },
  bicycle: { label: 'Bicycle', emoji: '🚲' },
  walk: { label: 'On foot', emoji: '🚶' },
};

export const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export const DAY_LABELS: Record<(typeof DAY_KEYS)[number], string> = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };

export const DEFAULT_CENTER = { lat: 34.1688, lng: 73.2215 }; // Abbottabad
