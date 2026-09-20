export type Role = 'CUSTOMER' | 'MERCHANT' | 'RUNNER' | 'ADMIN';
export type OrderStatus = 'PENDING' | 'ACCEPTED' | 'PREPARING' | 'READY' | 'ON_THE_WAY' | 'DELIVERED' | 'CANCELLED';
export type PaymentMethod = 'COD' | 'JAZZCASH' | 'EASYPAISA' | 'CARD' | 'WALLET';
export type PaymentStatus = 'UNPAID' | 'PAID' | 'REFUNDED';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  phone: string | null;
  avatarUrl: string | null;
  walletPoints: number;
  isActive: boolean;
  createdAt: string;
}

export interface Address {
  id: string;
  userId: string;
  label: string;
  line1: string;
  area: string | null;
  city: string;
  lat: number;
  lng: number;
  instructions: string | null;
  isDefault: boolean;
  createdAt: string;
}

export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export type ShopHours = Record<DayKey, { open: string; close: string; closed?: boolean }>;

export interface DeliveryZone {
  id: string;
  shopId: string;
  name: string;
  radiusKm: number;
  fee: number;
  freeAbove: number | null;
  sortOrder: number;
}

export interface Shop {
  id: string;
  ownerId: string;
  name: string;
  slug: string;
  category: string;
  description: string | null;
  phone: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  addressLine: string;
  lat: number;
  lng: number;
  isOpen: boolean;
  hours: ShopHours;
  prepTimeMin: number;
  minOrder: number;
  ratingAvg: number;
  ratingCount: number;
  status: 'PENDING' | 'APPROVED' | 'SUSPENDED';
  tags: string[];
  createdAt: string;
  // decorated
  isOpenNow: boolean;
  opensAt: string | null;
  todayHours: { open: string; close: string; closed?: boolean } | null;
  distanceKm: number | null;
  deliverable: boolean;
  deliveryFee: number;
  zoneName: string | null;
  maxRadiusKm: number;
  etaMinutes: number;
  zones: DeliveryZone[];
  categoryLabel: string;
  categoryEmoji: string;
  isFavorite?: boolean;
  matchedProducts?: string[];
}

export interface Product {
  id: string;
  shopId: string;
  name: string;
  description: string | null;
  category: string;
  unit: string;
  price: number;
  compareAtPrice: number | null;
  imageUrl: string | null;
  emoji: string | null;
  stock: number;
  isAvailable: boolean;
  isFeatured: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface FeaturedProduct extends Product {
  shopName: string;
  shopCategory: string;
  distanceKm: number;
}

export interface Review {
  id: string;
  orderId: string;
  shopId: string;
  runnerId: string | null;
  customerId: string;
  shopRating: number;
  runnerRating: number | null;
  comment: string | null;
  createdAt: string;
  customerName?: string;
}

export interface ShopDetail extends Shop {
  products: Product[];
  categories: string[];
  reviews: Review[];
}

export interface DeliveryAddress {
  label: string;
  line1: string;
  area?: string | null;
  city: string;
  lat: number;
  lng: number;
  instructions?: string | null;
  phone?: string | null;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string | null;
  name: string;
  unit: string;
  unitPrice: number;
  quantity: number;
  total: number;
  note: string | null;
  emoji: string | null;
  imageUrl: string | null;
}

export interface OrderEvent {
  id: string;
  orderId: string;
  status: string;
  note: string | null;
  actorId: string | null;
  actorRole: string | null;
  createdAt: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  groupId: string;
  customerId: string;
  shopId: string;
  runnerId: string | null;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paymentRef: string | null;
  subtotal: number;
  deliveryFee: number;
  serviceFee: number;
  discount: number;
  tip: number;
  total: number;
  distanceKm: number;
  etaMinutes: number;
  promoCode: string | null;
  notes: string | null;
  deliveryAddress: DeliveryAddress;
  scheduledFor: string | null;
  acceptedAt: string | null;
  readyAt: string | null;
  pickedUpAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  cancelledBy: string | null;
  cancelReason: string | null;
  pointsEarned: number;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  events: OrderEvent[];
  shop: { id: string; name: string; category: string; logoUrl: string | null; phone: string | null; lat: number; lng: number; addressLine: string; ownerId: string };
  customer: { id: string; name: string; phone: string | null; avatarUrl: string | null };
  runner: { id: string; name: string; phone: string | null; avatarUrl: string | null; vehicleType: string; lat: number | null; lng: number | null; ratingAvg: number } | null;
  review: Review | null;
}

export interface QuoteLine {
  productId: string;
  name: string;
  unit: string;
  unitPrice: number;
  quantity: number;
  total: number;
  emoji: string | null;
  imageUrl: string | null;
  available: boolean;
  stock: number;
}
export interface QuoteShop {
  shopId: string;
  shopName: string;
  isOpen: boolean;
  deliverable: boolean;
  distanceKm: number;
  maxRadiusKm: number;
  zoneName: string | null;
  deliveryFee: number;
  serviceFee: number;
  subtotal: number;
  discount: number;
  total: number;
  etaMinutes: number;
  minOrder: number;
  minOrderShortfall: number;
  issues: string[];
  items: QuoteLine[];
}
export interface Quote {
  shops: QuoteShop[];
  promo: { code: string; valid: boolean; message: string; type?: string } | null;
  tip: number;
  subtotal: number;
  deliveryFee: number;
  serviceFee: number;
  discount: number;
  grandTotal: number;
  ok: boolean;
  issues: string[];
  walletPoints: number;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: 'order' | 'delivery' | 'promo' | 'system' | 'chat';
  data: Record<string, unknown> & { orderId?: string; url?: string };
  isRead: boolean;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  orderId: string;
  senderId: string;
  senderRole: string;
  body: string;
  createdAt: string;
  senderName: string;
  senderAvatar: string | null;
}

export interface Promo {
  id: string;
  code: string;
  shopId: string | null;
  type: 'PERCENT' | 'FIXED' | 'FREE_DELIVERY';
  value: number;
  minOrder: number;
  maxDiscount: number | null;
  expiresAt: string | null;
  usageLimit: number | null;
  usedCount: number;
  isActive: boolean;
  createdAt: string;
  shopName?: string | null;
}

export interface RunnerProfile {
  userId: string;
  vehicleType: string;
  isAvailable: boolean;
  lat: number | null;
  lng: number | null;
  lastSeenAt: string | null;
  ratingAvg: number;
  ratingCount: number;
  totalDeliveries: number;
  shops?: { id: string; name: string; category: string; logoUrl: string | null }[];
}

export interface RunnerSummary {
  id: string;
  name: string;
  phone: string | null;
  email: string;
  avatarUrl: string | null;
  vehicleType: string;
  isAvailable: boolean;
  ratingAvg: number;
  totalDeliveries: number;
  lastSeenAt: string | null;
  distanceKm: number | null;
  activeDeliveries: number;
  mine: boolean;
}

export interface AppConfig {
  appName: string;
  currency: string;
  city: { name: string; lat: number; lng: number };
  serviceFee: number;
  pointsRatePct: number;
  customerCancelWindowMin: number;
  categories: { id: string; label: string; emoji: string }[];
  units: string[];
  paymentMethods: PaymentMethod[];
  googleClientId: string | null;
  vapidPublicKey: string;
  demo: { password: string } | null;
}

export interface MerchantAnalytics {
  days: number;
  totals: { revenue: number; commission: number; netPayout: number; orders: number; delivered: number; cancelled: number; avgOrderValue: number; rating: number; ratingCount: number };
  today: { orders: number; revenue: number; pending: number };
  series: { date: string; revenue: number; orders: number }[];
  topProducts: { name: string; quantity: number; revenue: number; emoji: string | null }[];
  statusCounts: { status: OrderStatus; count: number }[];
  lowStock: Product[];
}

export interface RunnerEarnings {
  today: { amount: number; deliveries: number };
  week: { amount: number; deliveries: number };
  month: { amount: number; deliveries: number; distanceKm: number };
  tips: number;
  series: { date: string; amount: number; deliveries: number }[];
  rating: number;
  ratingCount: number;
  totalDeliveries: number;
  recent: { id: string; deliveryFee: number; tip: number; deliveredAt: string | null; distanceKm: number; orderNumber: string; shopId: string }[];
}

export interface AdminStats {
  users: Record<Role, number>;
  shops: Record<'PENDING' | 'APPROVED' | 'SUSPENDED', number>;
  orders: Record<OrderStatus, number>;
  today: { orders: number; value: number };
  gmv: number;
  platformRevenue: number;
  activeRunners: number;
  series: { date: string; orders: number; gmv: number }[];
}

export interface LatLng {
  lat: number;
  lng: number;
}
