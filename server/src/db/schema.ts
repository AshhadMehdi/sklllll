import { sqliteTable, text, integer, real, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
import { nanoid } from 'nanoid';

const nowIso = () => new Date().toISOString();
const id = () => text('id').primaryKey().$defaultFn(() => nanoid(14));
const createdAt = () => text('created_at').notNull().$defaultFn(nowIso);
const updatedAt = () => text('updated_at').notNull().$defaultFn(nowIso).$onUpdateFn(nowIso);
const bool = (name: string, def = false) => integer(name, { mode: 'boolean' }).notNull().default(def);

// ───────────────────────────── Users & auth ─────────────────────────────
export const users = sqliteTable(
  'users',
  {
    id: id(),
    email: text('email').notNull(),
    phone: text('phone'),
    name: text('name').notNull(),
    passwordHash: text('password_hash'),
    role: text('role').notNull().default('CUSTOMER'), // CUSTOMER | MERCHANT | RUNNER | ADMIN
    avatarUrl: text('avatar_url'),
    googleId: text('google_id'),
    isActive: bool('is_active', true),
    walletPoints: integer('wallet_points').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('users_email_idx').on(t.email), index('users_role_idx').on(t.role)],
);

export const addresses = sqliteTable(
  'addresses',
  {
    id: id(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    label: text('label').notNull().default('Home'),
    line1: text('line1').notNull(),
    area: text('area'),
    city: text('city').notNull().default('Abbottabad'),
    lat: real('lat').notNull(),
    lng: real('lng').notNull(),
    instructions: text('instructions'),
    isDefault: bool('is_default'),
    createdAt: createdAt(),
  },
  (t) => [index('addresses_user_idx').on(t.userId)],
);

// ───────────────────────────── Shops & catalog ─────────────────────────────
export const shops = sqliteTable(
  'shops',
  {
    id: id(),
    ownerId: text('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    category: text('category').notNull().default('grocery'),
    description: text('description'),
    phone: text('phone'),
    logoUrl: text('logo_url'),
    coverUrl: text('cover_url'),
    addressLine: text('address_line').notNull(),
    lat: real('lat').notNull(),
    lng: real('lng').notNull(),
    isOpen: bool('is_open', true),
    hours: text('hours', { mode: 'json' }).$type<ShopHours>().notNull(),
    prepTimeMin: integer('prep_time_min').notNull().default(15),
    minOrder: real('min_order').notNull().default(0),
    ratingAvg: real('rating_avg').notNull().default(0),
    ratingCount: integer('rating_count').notNull().default(0),
    status: text('status').notNull().default('PENDING'), // PENDING | APPROVED | SUSPENDED
    tags: text('tags', { mode: 'json' }).$type<string[]>().notNull().default([]),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('shops_slug_idx').on(t.slug), index('shops_owner_idx').on(t.ownerId), index('shops_status_idx').on(t.status)],
);

export const deliveryZones = sqliteTable(
  'delivery_zones',
  {
    id: id(),
    shopId: text('shop_id').notNull().references(() => shops.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    radiusKm: real('radius_km').notNull(),
    fee: real('fee').notNull(),
    freeAbove: real('free_above'),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [index('zones_shop_idx').on(t.shopId)],
);

export const products = sqliteTable(
  'products',
  {
    id: id(),
    shopId: text('shop_id').notNull().references(() => shops.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    category: text('category').notNull().default('General'),
    unit: text('unit').notNull().default('piece'),
    price: real('price').notNull(),
    compareAtPrice: real('compare_at_price'),
    imageUrl: text('image_url'),
    emoji: text('emoji'),
    stock: integer('stock').notNull().default(0),
    isAvailable: bool('is_available', true),
    isFeatured: bool('is_featured'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('products_shop_idx').on(t.shopId)],
);

// ───────────────────────────── Runners ─────────────────────────────
export const runnerProfiles = sqliteTable('runner_profiles', {
  userId: text('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  vehicleType: text('vehicle_type').notNull().default('bike'), // bike | scooter | car | bicycle | walk
  isAvailable: bool('is_available'),
  lat: real('lat'),
  lng: real('lng'),
  lastSeenAt: text('last_seen_at'),
  ratingAvg: real('rating_avg').notNull().default(0),
  ratingCount: integer('rating_count').notNull().default(0),
  totalDeliveries: integer('total_deliveries').notNull().default(0),
  createdAt: createdAt(),
});

export const shopRunners = sqliteTable(
  'shop_runners',
  {
    id: id(),
    shopId: text('shop_id').notNull().references(() => shops.id, { onDelete: 'cascade' }),
    runnerId: text('runner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('shop_runners_unique').on(t.shopId, t.runnerId)],
);

// ───────────────────────────── Orders ─────────────────────────────
export const orders = sqliteTable(
  'orders',
  {
    id: id(),
    orderNumber: text('order_number').notNull(),
    groupId: text('group_id').notNull(),
    customerId: text('customer_id').notNull().references(() => users.id),
    shopId: text('shop_id').notNull().references(() => shops.id),
    runnerId: text('runner_id').references(() => users.id),
    status: text('status').notNull().default('PENDING'),
    paymentMethod: text('payment_method').notNull().default('COD'), // COD | JAZZCASH | EASYPAISA | CARD | WALLET
    paymentStatus: text('payment_status').notNull().default('UNPAID'), // UNPAID | PAID | REFUNDED
    paymentRef: text('payment_ref'),
    subtotal: real('subtotal').notNull(),
    deliveryFee: real('delivery_fee').notNull().default(0),
    serviceFee: real('service_fee').notNull().default(0),
    discount: real('discount').notNull().default(0),
    tip: real('tip').notNull().default(0),
    total: real('total').notNull(),
    distanceKm: real('distance_km').notNull().default(0),
    etaMinutes: integer('eta_minutes').notNull().default(30),
    promoCode: text('promo_code'),
    notes: text('notes'),
    deliveryAddress: text('delivery_address', { mode: 'json' }).$type<DeliveryAddress>().notNull(),
    scheduledFor: text('scheduled_for'),
    acceptedAt: text('accepted_at'),
    readyAt: text('ready_at'),
    pickedUpAt: text('picked_up_at'),
    deliveredAt: text('delivered_at'),
    cancelledAt: text('cancelled_at'),
    cancelledBy: text('cancelled_by'),
    cancelReason: text('cancel_reason'),
    pointsEarned: integer('points_earned').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('orders_number_idx').on(t.orderNumber),
    index('orders_customer_idx').on(t.customerId),
    index('orders_shop_idx').on(t.shopId),
    index('orders_runner_idx').on(t.runnerId),
    index('orders_status_idx').on(t.status),
    index('orders_group_idx').on(t.groupId),
  ],
);

export const orderItems = sqliteTable(
  'order_items',
  {
    id: id(),
    orderId: text('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
    productId: text('product_id'),
    name: text('name').notNull(),
    unit: text('unit').notNull().default('piece'),
    unitPrice: real('unit_price').notNull(),
    quantity: integer('quantity').notNull(),
    total: real('total').notNull(),
    note: text('note'),
    emoji: text('emoji'),
    imageUrl: text('image_url'),
  },
  (t) => [index('order_items_order_idx').on(t.orderId)],
);

export const orderEvents = sqliteTable(
  'order_events',
  {
    id: id(),
    orderId: text('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
    status: text('status').notNull(),
    note: text('note'),
    actorId: text('actor_id'),
    actorRole: text('actor_role'),
    createdAt: createdAt(),
  },
  (t) => [index('order_events_order_idx').on(t.orderId)],
);

export const reviews = sqliteTable(
  'reviews',
  {
    id: id(),
    orderId: text('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
    shopId: text('shop_id').notNull().references(() => shops.id, { onDelete: 'cascade' }),
    runnerId: text('runner_id'),
    customerId: text('customer_id').notNull(),
    shopRating: integer('shop_rating').notNull(),
    runnerRating: integer('runner_rating'),
    comment: text('comment'),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('reviews_order_idx').on(t.orderId), index('reviews_shop_idx').on(t.shopId)],
);

export const promos = sqliteTable(
  'promos',
  {
    id: id(),
    code: text('code').notNull(),
    shopId: text('shop_id').references(() => shops.id, { onDelete: 'cascade' }),
    type: text('type').notNull(), // PERCENT | FIXED | FREE_DELIVERY
    value: real('value').notNull().default(0),
    minOrder: real('min_order').notNull().default(0),
    maxDiscount: real('max_discount'),
    expiresAt: text('expires_at'),
    usageLimit: integer('usage_limit'),
    usedCount: integer('used_count').notNull().default(0),
    isActive: bool('is_active', true),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('promos_code_idx').on(t.code)],
);

// ───────────────────────────── Messaging & notifications ─────────────────────────────
export const notifications = sqliteTable(
  'notifications',
  {
    id: id(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    body: text('body').notNull(),
    type: text('type').notNull().default('info'),
    data: text('data', { mode: 'json' }).$type<Record<string, unknown>>().notNull().default({}),
    isRead: bool('is_read'),
    createdAt: createdAt(),
  },
  (t) => [index('notifications_user_idx').on(t.userId)],
);

export const messages = sqliteTable(
  'messages',
  {
    id: id(),
    orderId: text('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
    senderId: text('sender_id').notNull(),
    senderRole: text('sender_role').notNull(),
    body: text('body').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('messages_order_idx').on(t.orderId)],
);

export const pushSubscriptions = sqliteTable(
  'push_subscriptions',
  {
    id: id(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    endpoint: text('endpoint').notNull(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('push_endpoint_idx').on(t.endpoint)],
);

export const favorites = sqliteTable(
  'favorites',
  {
    id: id(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    shopId: text('shop_id').notNull().references(() => shops.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('favorites_unique').on(t.userId, t.shopId)],
);

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value', { mode: 'json' }).$type<unknown>().notNull(),
});

// ───────────────────────────── Shared types ─────────────────────────────
export type ShopHours = Record<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun', { open: string; close: string; closed?: boolean }>;
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

export type User = typeof users.$inferSelect;
export type Shop = typeof shops.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type DeliveryZone = typeof deliveryZones.$inferSelect;
export type Address = typeof addresses.$inferSelect;
export type RunnerProfile = typeof runnerProfiles.$inferSelect;
export type Promo = typeof promos.$inferSelect;
