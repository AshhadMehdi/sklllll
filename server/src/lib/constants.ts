export const ROLES = ['CUSTOMER', 'MERCHANT', 'RUNNER', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

export const ORDER_STATUSES = ['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'ON_THE_WAY', 'DELIVERED', 'CANCELLED'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ACTIVE_ORDER_STATUSES: OrderStatus[] = ['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'ON_THE_WAY'];

export const PAYMENT_METHODS = ['COD', 'JAZZCASH', 'EASYPAISA', 'CARD', 'WALLET'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const SHOP_CATEGORIES = [
  { id: 'grocery', label: 'Grocery', emoji: '🛒' },
  { id: 'vegetables', label: 'Vegetables', emoji: '🥬' },
  { id: 'fruits', label: 'Fruits', emoji: '🍎' },
  { id: 'meat', label: 'Meat & Chicken', emoji: '🥩' },
  { id: 'dairy', label: 'Dairy & Eggs', emoji: '🥛' },
  { id: 'bakery', label: 'Bakery & Sweets', emoji: '🥐' },
  { id: 'mart', label: 'Mart', emoji: '🏪' },
  { id: 'pharmacy', label: 'Pharmacy', emoji: '💊' },
  { id: 'other', label: 'Other', emoji: '🧺' },
] as const;
export type ShopCategory = (typeof SHOP_CATEGORIES)[number]['id'];

export const PRODUCT_UNITS = ['piece', 'kg', '500g', '250g', 'dozen', 'liter', 'pack', 'bunch', 'box', 'bottle'] as const;

export const DEFAULT_SETTINGS = {
  serviceFee: 15, // flat platform fee per shop order (PKR)
  commissionPct: 8, // merchant commission (%), for analytics only
  currency: 'PKR',
  pointsRatePct: 2, // loyalty: % of subtotal earned as wallet points when delivered
  allowPlatformRunners: true, // auto-assign may pick any available runner, not only the shop's own
  maxDeliveryRadiusKm: 15,
  customerCancelWindowMin: 5, // customers can cancel until this many minutes after acceptance
  cityName: 'Abbottabad',
  cityLat: 34.1688,
  cityLng: 73.2215,
};
export type PlatformSettings = typeof DEFAULT_SETTINGS;

export const NOTIFICATION_TYPES = ['order', 'delivery', 'promo', 'system', 'chat'] as const;
