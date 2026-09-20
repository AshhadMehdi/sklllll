import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { customAlphabet } from 'nanoid';
import { db, schema } from '../db/index.js';
import type { DeliveryAddress, Order } from '../db/schema.js';
import { ACTIVE_ORDER_STATUSES, type OrderStatus, type PaymentMethod, type Role } from './constants.js';
import { badRequest, conflict, forbidden, notFound } from './errors.js';
import { estimateEtaMinutes, haversineKm, isWithinHours, resolveZone, round2 } from './geo.js';
import { notify } from './notify.js';
import { getSettings } from './settings.js';
import { emitToAdmins, emitToOrder, emitToShop, emitToUser } from '../socket.js';

const orderNo = customAlphabet('23456789ABCDEFGHJKLMNPQRSTUVWXYZ', 6);
export const newOrderNumber = () => `QB-${orderNo()}`;

// ───────────────────────────── Serialisation ─────────────────────────────
export interface OrderDTO extends Order {
  items: schema.OrderItem[];
  events: (typeof schema.orderEvents.$inferSelect)[];
  shop: { id: string; name: string; category: string; logoUrl: string | null; phone: string | null; lat: number; lng: number; addressLine: string; ownerId: string };
  customer: { id: string; name: string; phone: string | null; avatarUrl: string | null };
  runner: { id: string; name: string; phone: string | null; avatarUrl: string | null; vehicleType: string; lat: number | null; lng: number | null; ratingAvg: number } | null;
  review: (typeof schema.reviews.$inferSelect) | null;
}

export async function serializeOrders(list: Order[]): Promise<OrderDTO[]> {
  if (!list.length) return [];
  const ids = list.map((o) => o.id);
  const shopIds = [...new Set(list.map((o) => o.shopId))];
  const userIds = [...new Set(list.flatMap((o) => [o.customerId, o.runnerId]).filter((x): x is string => !!x))];
  const [items, events, shopsRows, usersRows, runnerRows, reviewRows] = await Promise.all([
    db.select().from(schema.orderItems).where(inArray(schema.orderItems.orderId, ids)),
    db.select().from(schema.orderEvents).where(inArray(schema.orderEvents.orderId, ids)).orderBy(schema.orderEvents.createdAt),
    db.select().from(schema.shops).where(inArray(schema.shops.id, shopIds)),
    db.select().from(schema.users).where(inArray(schema.users.id, userIds)),
    db.select().from(schema.runnerProfiles).where(inArray(schema.runnerProfiles.userId, userIds)),
    db.select().from(schema.reviews).where(inArray(schema.reviews.orderId, ids)),
  ]);
  const shopMap = new Map(shopsRows.map((s) => [s.id, s]));
  const userMap = new Map(usersRows.map((u) => [u.id, u]));
  const runnerMap = new Map(runnerRows.map((r) => [r.userId, r]));
  const reviewMap = new Map(reviewRows.map((r) => [r.orderId, r]));
  return list.map((o) => {
    const s = shopMap.get(o.shopId)!;
    const c = userMap.get(o.customerId);
    const r = o.runnerId ? userMap.get(o.runnerId) : null;
    const rp = o.runnerId ? runnerMap.get(o.runnerId) : null;
    return {
      ...o,
      items: items.filter((i) => i.orderId === o.id),
      events: events.filter((e) => e.orderId === o.id),
      shop: s ? { id: s.id, name: s.name, category: s.category, logoUrl: s.logoUrl, phone: s.phone, lat: s.lat, lng: s.lng, addressLine: s.addressLine, ownerId: s.ownerId } : (null as never),
      customer: c ? { id: c.id, name: c.name, phone: c.phone, avatarUrl: c.avatarUrl } : { id: o.customerId, name: 'Customer', phone: null, avatarUrl: null },
      runner: r ? { id: r.id, name: r.name, phone: r.phone, avatarUrl: r.avatarUrl, vehicleType: rp?.vehicleType ?? 'bike', lat: rp?.lat ?? null, lng: rp?.lng ?? null, ratingAvg: rp?.ratingAvg ?? 0 } : null,
      review: reviewMap.get(o.id) ?? null,
    };
  });
}

export async function getOrder(orderId: string): Promise<OrderDTO> {
  const [o] = await db.select().from(schema.orders).where(eq(schema.orders.id, orderId)).limit(1);
  if (!o) throw notFound('Order not found');
  const [dto] = await serializeOrders([o]);
  return dto;
}

export function broadcastOrder(dto: OrderDTO, event: 'order:created' | 'order:updated' = 'order:updated') {
  emitToOrder(dto.id, event, dto);
  emitToUser(dto.customerId, event, dto);
  emitToShop(dto.shopId, event, dto);
  if (dto.runnerId) emitToUser(dto.runnerId, event, dto);
  emitToAdmins(event, dto);
}

export async function addEvent(orderId: string, status: string, actor?: { id: string; role: Role } | null, note?: string | null) {
  await db.insert(schema.orderEvents).values({ orderId, status, note: note ?? null, actorId: actor?.id ?? null, actorRole: actor?.role ?? null });
}

// ───────────────────────────── Quote & checkout ─────────────────────────────
export interface CartShopInput {
  shopId: string;
  notes?: string;
  items: { productId: string; quantity: number; note?: string }[];
}
export interface QuoteInput {
  address: DeliveryAddress;
  shops: CartShopInput[];
  promoCode?: string | null;
  tip?: number;
  paymentMethod?: PaymentMethod;
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
  note?: string;
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
  notes?: string;
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
}

export async function buildQuote(input: QuoteInput): Promise<Quote> {
  const settings = await getSettings();
  const shopIds = [...new Set(input.shops.map((s) => s.shopId))];
  if (!shopIds.length) throw badRequest('Your cart is empty');
  const productIds = [...new Set(input.shops.flatMap((s) => s.items.map((i) => i.productId)))];
  const [shopRows, zoneRows, productRows] = await Promise.all([
    db.select().from(schema.shops).where(inArray(schema.shops.id, shopIds)),
    db.select().from(schema.deliveryZones).where(inArray(schema.deliveryZones.shopId, shopIds)),
    productIds.length ? db.select().from(schema.products).where(inArray(schema.products.id, productIds)) : Promise.resolve([]),
  ]);
  const productMap = new Map(productRows.map((p) => [p.id, p]));

  // Promo lookup (optional)
  let promoRow: schema.Promo | null = null;
  let promo: Quote['promo'] = null;
  if (input.promoCode) {
    const code = input.promoCode.trim().toUpperCase();
    const [p] = await db.select().from(schema.promos).where(eq(schema.promos.code, code)).limit(1);
    if (!p || !p.isActive) promo = { code, valid: false, message: 'This promo code is not valid' };
    else if (p.expiresAt && new Date(p.expiresAt) < new Date()) promo = { code, valid: false, message: 'This promo code has expired' };
    else if (p.usageLimit != null && p.usedCount >= p.usageLimit) promo = { code, valid: false, message: 'This promo code has been fully redeemed' };
    else {
      promoRow = p;
      promo = { code, valid: true, message: 'Promo applied', type: p.type };
    }
  }

  const shopsOut: QuoteShop[] = [];
  for (const cartShop of input.shops) {
    const shop = shopRows.find((s) => s.id === cartShop.shopId);
    if (!shop) throw badRequest('One of the shops in your cart no longer exists');
    const issues: string[] = [];
    const lines: QuoteLine[] = [];
    let subtotal = 0;
    for (const it of cartShop.items) {
      const p = productMap.get(it.productId);
      const qty = Math.max(1, Math.min(99, Math.floor(it.quantity)));
      if (!p || p.shopId !== shop.id) {
        issues.push('An item in your cart is no longer sold by this shop');
        continue;
      }
      const available = p.isAvailable && p.stock >= qty;
      if (!p.isAvailable) issues.push(`${p.name} is currently unavailable`);
      else if (p.stock < qty) issues.push(`Only ${p.stock} × ${p.name} left in stock`);
      const total = round2(p.price * qty);
      if (available) subtotal += total;
      lines.push({ productId: p.id, name: p.name, unit: p.unit, unitPrice: p.price, quantity: qty, total, emoji: p.emoji, imageUrl: p.imageUrl, available, stock: p.stock, note: it.note });
    }
    subtotal = round2(subtotal);
    const distanceKm = haversineKm(shop.lat, shop.lng, input.address.lat, input.address.lng);
    const zone = resolveZone(
      zoneRows.filter((z) => z.shopId === shop.id),
      distanceKm,
      subtotal,
    );
    const hours = isWithinHours(shop.hours);
    const isOpen = shop.isOpen && hours.open && shop.status === 'APPROVED';
    if (!isOpen) issues.push(`${shop.name} is closed right now${hours.opensAt ? ` (opens ${hours.opensAt})` : ''}`);
    if (!zone.deliverable) issues.push(`${shop.name} doesn't deliver to this address (max ${zone.maxRadiusKm} km, you are ${zone.distanceKm} km away)`);
    const minOrderShortfall = Math.max(0, round2(shop.minOrder - subtotal));
    if (minOrderShortfall > 0) issues.push(`Add Rs ${minOrderShortfall} more to reach ${shop.name}'s minimum order of Rs ${shop.minOrder}`);
    if (!lines.some((l) => l.available)) issues.push('No available items for this shop');

    let deliveryFee = zone.fee;
    let discount = 0;
    const serviceFee = settings.serviceFee;
    // Promo application: shop-specific promos apply to their shop only; platform promos apply to every shop order.
    if (promoRow && (!promoRow.shopId || promoRow.shopId === shop.id)) {
      if (subtotal >= promoRow.minOrder) {
        if (promoRow.type === 'FREE_DELIVERY') deliveryFee = 0;
        else if (promoRow.type === 'PERCENT') discount = round2(Math.min((subtotal * promoRow.value) / 100, promoRow.maxDiscount ?? Infinity));
        else if (promoRow.type === 'FIXED') discount = round2(Math.min(promoRow.value, subtotal));
      } else if (promo) {
        promo = { ...promo, valid: promo.valid, message: `Spend Rs ${promoRow.minOrder} at ${shop.name} to use this code` };
      }
    }
    const total = round2(Math.max(0, subtotal + deliveryFee + serviceFee - discount));
    shopsOut.push({
      shopId: shop.id,
      shopName: shop.name,
      isOpen,
      deliverable: zone.deliverable,
      distanceKm: zone.distanceKm,
      maxRadiusKm: zone.maxRadiusKm,
      zoneName: zone.zone?.name ?? null,
      deliveryFee,
      serviceFee,
      subtotal,
      discount,
      total,
      etaMinutes: estimateEtaMinutes(shop.prepTimeMin, distanceKm),
      minOrder: shop.minOrder,
      minOrderShortfall,
      issues,
      items: lines,
      notes: cartShop.notes,
    });
  }

  const tip = Math.max(0, round2(input.tip ?? 0));
  const sum = (k: keyof Pick<QuoteShop, 'subtotal' | 'deliveryFee' | 'serviceFee' | 'discount' | 'total'>) => round2(shopsOut.reduce((a, s) => a + s[k], 0));
  const issues = shopsOut.flatMap((s) => s.issues);
  return {
    shops: shopsOut,
    promo,
    tip,
    subtotal: sum('subtotal'),
    deliveryFee: sum('deliveryFee'),
    serviceFee: sum('serviceFee'),
    discount: sum('discount'),
    grandTotal: round2(sum('total') + tip),
    ok: issues.length === 0,
    issues,
  };
}

export interface PlaceInput extends QuoteInput {
  paymentMethod: PaymentMethod;
  notes?: string;
  scheduledFor?: string | null;
}

export async function placeOrders(customerId: string, input: PlaceInput): Promise<OrderDTO[]> {
  const quote = await buildQuote(input);
  if (!quote.ok) throw badRequest(quote.issues[0] ?? 'Your cart has issues', { issues: quote.issues });
  const settings = await getSettings();
  const [customer] = await db.select().from(schema.users).where(eq(schema.users.id, customerId)).limit(1);
  if (!customer) throw notFound('Customer not found');
  if (input.paymentMethod === 'WALLET' && customer.walletPoints < quote.grandTotal) {
    throw badRequest(`Not enough wallet points. You have ${customer.walletPoints} pts, this order needs ${quote.grandTotal}.`);
  }
  const groupId = newOrderNumber();
  const paid = input.paymentMethod !== 'COD';
  const paymentRef = paid ? `${input.paymentMethod}-${Date.now().toString(36).toUpperCase()}` : null;
  const tipPerShop = quote.shops.length ? round2(quote.tip / quote.shops.length) : 0;

  const created = await db.transaction(async (tx) => {
    const out: Order[] = [];
    for (const qs of quote.shops) {
      const availableLines = qs.items.filter((l) => l.available);
      // Decrement stock atomically; abort if a race made something unavailable
      for (const line of availableLines) {
        const res = await tx
          .update(schema.products)
          .set({ stock: sql`${schema.products.stock} - ${line.quantity}` })
          .where(and(eq(schema.products.id, line.productId), sql`${schema.products.stock} >= ${line.quantity}`))
          .returning({ id: schema.products.id });
        if (!res.length) throw conflict(`${line.name} just went out of stock`);
      }
      const [order] = await tx
        .insert(schema.orders)
        .values({
          orderNumber: newOrderNumber(),
          groupId,
          customerId,
          shopId: qs.shopId,
          status: 'PENDING',
          paymentMethod: input.paymentMethod,
          paymentStatus: paid ? 'PAID' : 'UNPAID',
          paymentRef,
          subtotal: qs.subtotal,
          deliveryFee: qs.deliveryFee,
          serviceFee: qs.serviceFee,
          discount: qs.discount,
          tip: tipPerShop,
          total: round2(qs.total + tipPerShop),
          distanceKm: qs.distanceKm,
          etaMinutes: qs.etaMinutes,
          promoCode: quote.promo?.valid ? quote.promo.code : null,
          notes: [input.notes, qs.notes].filter(Boolean).join(' · ') || null,
          deliveryAddress: { ...input.address, phone: input.address.phone ?? customer.phone ?? null },
          scheduledFor: input.scheduledFor ?? null,
        })
        .returning();
      await tx.insert(schema.orderItems).values(
        availableLines.map((l) => ({ orderId: order.id, productId: l.productId, name: l.name, unit: l.unit, unitPrice: l.unitPrice, quantity: l.quantity, total: l.total, note: l.note ?? null, emoji: l.emoji, imageUrl: l.imageUrl })),
      );
      await tx.insert(schema.orderEvents).values({ orderId: order.id, status: 'PENDING', note: 'Order placed', actorId: customerId, actorRole: 'CUSTOMER' });
      out.push(order);
    }
    if (quote.promo?.valid) {
      await tx.update(schema.promos).set({ usedCount: sql`${schema.promos.usedCount} + 1` }).where(eq(schema.promos.code, quote.promo.code));
    }
    if (input.paymentMethod === 'WALLET') {
      await tx.update(schema.users).set({ walletPoints: sql`${schema.users.walletPoints} - ${Math.round(quote.grandTotal)}` }).where(eq(schema.users.id, customerId));
    }
    return out;
  });

  const dtos = await serializeOrders(created);
  for (const dto of dtos) {
    broadcastOrder(dto, 'order:created');
    notify(dto.shop.ownerId, {
      title: `New order ${dto.orderNumber}`,
      body: `${dto.customer.name} ordered ${dto.items.length} item${dto.items.length === 1 ? '' : 's'} · Rs ${dto.total}`,
      type: 'order',
      data: { orderId: dto.id },
      url: `/merchant/orders/${dto.id}`,
    }).catch(() => {});
  }
  notify(customerId, {
    title: dtos.length > 1 ? `${dtos.length} orders placed` : `Order ${dtos[0].orderNumber} placed`,
    body: `We've sent your order to ${dtos.map((d) => d.shop.name).join(', ')}. You'll be notified when it's accepted.`,
    type: 'order',
    data: { orderId: dtos[0].id, groupId },
    url: `/orders/${dtos[0].id}`,
    push: false,
  }).catch(() => {});
  void settings;
  return dtos;
}

// ───────────────────────────── Status transitions ─────────────────────────────
const NEXT: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['ACCEPTED', 'CANCELLED'],
  ACCEPTED: ['PREPARING', 'READY', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY: ['ON_THE_WAY', 'DELIVERED', 'CANCELLED'],
  ON_THE_WAY: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: [],
};

export const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: 'Waiting for shop',
  ACCEPTED: 'Accepted',
  PREPARING: 'Being prepared',
  READY: 'Ready for pickup',
  ON_THE_WAY: 'On the way',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

export interface Actor {
  id: string;
  role: Role;
  name: string;
}

export async function transitionOrder(orderId: string, next: OrderStatus, actor: Actor, opts: { note?: string; reason?: string; shopIds?: string[] } = {}): Promise<OrderDTO> {
  const current = await getOrder(orderId);
  const from = current.status as OrderStatus;

  // Authorisation
  const isCustomer = current.customerId === actor.id;
  const isRunner = current.runnerId === actor.id;
  const isShop = actor.role === 'MERCHANT' && (opts.shopIds ?? []).includes(current.shopId);
  const isAdmin = actor.role === 'ADMIN';
  if (!isCustomer && !isRunner && !isShop && !isAdmin) throw forbidden();

  if (!NEXT[from].includes(next)) throw conflict(`Cannot move an order from ${STATUS_LABEL[from]} to ${STATUS_LABEL[next]}`);

  const settings = await getSettings();
  if (isCustomer && !isAdmin) {
    if (next !== 'CANCELLED') throw forbidden('Customers can only cancel orders');
    const acceptedAgo = current.acceptedAt ? (Date.now() - new Date(current.acceptedAt).getTime()) / 60000 : 0;
    if (from !== 'PENDING' && !(from === 'ACCEPTED' && acceptedAgo <= settings.customerCancelWindowMin)) {
      throw conflict('This order is already being prepared and can no longer be cancelled. Please contact the shop.');
    }
  }
  if (isRunner && !isShop && !isAdmin) {
    if (!['ON_THE_WAY', 'DELIVERED'].includes(next)) throw forbidden('Runners can only mark orders picked up or delivered');
  }
  if (isShop && ['ON_THE_WAY', 'DELIVERED'].includes(next) && current.runnerId && !isAdmin) {
    // A shop may self-deliver only when no runner is assigned
    throw conflict('A runner is assigned to this order — they will update pickup and delivery');
  }

  const now = new Date().toISOString();
  const patch: Partial<Order> = { status: next };
  if (next === 'ACCEPTED') patch.acceptedAt = now;
  if (next === 'READY') patch.readyAt = now;
  if (next === 'ON_THE_WAY') patch.pickedUpAt = now;
  if (next === 'DELIVERED') {
    patch.deliveredAt = now;
    if (current.paymentMethod === 'COD') patch.paymentStatus = 'PAID';
    patch.pointsEarned = Math.floor((current.subtotal * settings.pointsRatePct) / 100);
  }
  if (next === 'CANCELLED') {
    patch.cancelledAt = now;
    patch.cancelledBy = isCustomer ? 'CUSTOMER' : isShop ? 'SHOP' : isRunner ? 'RUNNER' : 'ADMIN';
    patch.cancelReason = opts.reason ?? opts.note ?? null;
    if (current.paymentStatus === 'PAID') patch.paymentStatus = 'REFUNDED';
  }

  await db.transaction(async (tx) => {
    await tx.update(schema.orders).set(patch).where(eq(schema.orders.id, orderId));
    await tx.insert(schema.orderEvents).values({ orderId, status: next, note: opts.note ?? opts.reason ?? null, actorId: actor.id, actorRole: actor.role });
    if (next === 'CANCELLED') {
      // restock items & refund wallet
      for (const item of current.items) {
        if (item.productId) await tx.update(schema.products).set({ stock: sql`${schema.products.stock} + ${item.quantity}` }).where(eq(schema.products.id, item.productId));
      }
      if (current.paymentMethod === 'WALLET' && current.paymentStatus === 'PAID') {
        await tx.update(schema.users).set({ walletPoints: sql`${schema.users.walletPoints} + ${Math.round(current.total)}` }).where(eq(schema.users.id, current.customerId));
      }
    }
    if (next === 'DELIVERED') {
      if (patch.pointsEarned) await tx.update(schema.users).set({ walletPoints: sql`${schema.users.walletPoints} + ${patch.pointsEarned}` }).where(eq(schema.users.id, current.customerId));
      if (current.runnerId) await tx.update(schema.runnerProfiles).set({ totalDeliveries: sql`${schema.runnerProfiles.totalDeliveries} + 1` }).where(eq(schema.runnerProfiles.userId, current.runnerId));
    }
  });

  const dto = await getOrder(orderId);
  broadcastOrder(dto);

  // Notifications
  const customerMsg: Partial<Record<OrderStatus, string>> = {
    ACCEPTED: `${dto.shop.name} accepted your order. Estimated delivery in ~${dto.etaMinutes} min.`,
    PREPARING: `${dto.shop.name} is preparing your order.`,
    READY: `Your order is packed and ready for pickup.`,
    ON_THE_WAY: `${dto.runner?.name ?? 'Your rider'} has picked up your order and is on the way!`,
    DELIVERED: `Your order was delivered. Enjoy!${patch.pointsEarned ? ` You earned ${patch.pointsEarned} loyalty points.` : ''}`,
    CANCELLED: `Your order was cancelled${opts.reason ? `: ${opts.reason}` : ''}.`,
  };
  if (!isCustomer && customerMsg[next]) {
    notify(dto.customerId, { title: `Order ${dto.orderNumber} · ${STATUS_LABEL[next]}`, body: customerMsg[next]!, type: 'order', data: { orderId }, url: `/orders/${orderId}` }).catch(() => {});
  }
  if (!isShop && (next === 'CANCELLED' || next === 'DELIVERED' || next === 'ON_THE_WAY')) {
    notify(dto.shop.ownerId, { title: `Order ${dto.orderNumber} · ${STATUS_LABEL[next]}`, body: next === 'CANCELLED' ? `Cancelled by ${patch.cancelledBy?.toLowerCase()}${opts.reason ? `: ${opts.reason}` : ''}` : customerMsg[next]!, type: 'order', data: { orderId }, url: `/merchant/orders/${orderId}` }).catch(() => {});
  }
  if (dto.runnerId && !isRunner && (next === 'READY' || next === 'CANCELLED')) {
    notify(dto.runnerId, { title: `Order ${dto.orderNumber} · ${STATUS_LABEL[next]}`, body: next === 'READY' ? `${dto.shop.name} has the order ready for pickup.` : 'This delivery was cancelled.', type: 'delivery', data: { orderId }, url: `/runner/deliveries/${orderId}` }).catch(() => {});
  }
  return dto;
}

// ───────────────────────────── Runner assignment ─────────────────────────────
export async function assignRunner(orderId: string, runnerId: string | 'auto' | null, actor: Actor, shopIds: string[]): Promise<OrderDTO> {
  const current = await getOrder(orderId);
  if (actor.role !== 'ADMIN' && !shopIds.includes(current.shopId)) throw forbidden();
  if (!ACTIVE_ORDER_STATUSES.includes(current.status as OrderStatus) || current.status === 'PENDING') throw conflict('Accept the order before assigning a runner');
  if (current.status === 'ON_THE_WAY') throw conflict('Order is already on the way');

  let chosen: string | null = null;
  if (runnerId === 'auto') {
    const settings = await getSettings();
    const own = (await db.select({ id: schema.shopRunners.runnerId }).from(schema.shopRunners).where(eq(schema.shopRunners.shopId, current.shopId))).map((r) => r.id);
    const candidates = await db
      .select({ profile: schema.runnerProfiles, user: schema.users })
      .from(schema.runnerProfiles)
      .innerJoin(schema.users, eq(schema.users.id, schema.runnerProfiles.userId))
      .where(and(eq(schema.runnerProfiles.isAvailable, true), eq(schema.users.isActive, true)));
    // Active load per runner
    const loads = await db
      .select({ runnerId: schema.orders.runnerId, n: sql<number>`count(*)` })
      .from(schema.orders)
      .where(and(inArray(schema.orders.status, ['READY', 'ON_THE_WAY', 'ACCEPTED', 'PREPARING']), sql`${schema.orders.runnerId} is not null`))
      .groupBy(schema.orders.runnerId);
    const loadMap = new Map(loads.map((l) => [l.runnerId, Number(l.n)]));
    const scored = candidates
      .filter((c) => own.includes(c.user.id) || settings.allowPlatformRunners)
      .map((c) => {
        const dist = c.profile.lat != null && c.profile.lng != null ? haversineKm(c.profile.lat, c.profile.lng, current.shop.lat, current.shop.lng) : 50;
        const load = loadMap.get(c.user.id) ?? 0;
        const score = dist + load * 2 + (own.includes(c.user.id) ? 0 : 1.5);
        return { id: c.user.id, score };
      })
      .sort((a, b) => a.score - b.score);
    if (!scored.length) throw conflict('No runners are available right now. Try again in a moment or assign one manually.');
    chosen = scored[0].id;
  } else if (runnerId) {
    const [u] = await db.select().from(schema.users).where(and(eq(schema.users.id, runnerId), eq(schema.users.role, 'RUNNER'))).limit(1);
    if (!u) throw notFound('Runner not found');
    chosen = u.id;
  }

  await db.update(schema.orders).set({ runnerId: chosen }).where(eq(schema.orders.id, orderId));
  await addEvent(orderId, current.status, actor, chosen ? 'Runner assigned' : 'Runner unassigned');
  const dto = await getOrder(orderId);
  broadcastOrder(dto);
  if (chosen) {
    notify(chosen, { title: `New delivery ${dto.orderNumber}`, body: `Pick up from ${dto.shop.name} → ${dto.deliveryAddress.area || dto.deliveryAddress.line1}. ${dto.distanceKm} km, Rs ${dto.deliveryFee + dto.tip} for you.`, type: 'delivery', data: { orderId }, url: `/runner/deliveries/${orderId}` }).catch(() => {});
    notify(dto.customerId, { title: `Rider assigned`, body: `${dto.runner?.name} will deliver your order from ${dto.shop.name}.`, type: 'delivery', data: { orderId }, url: `/orders/${orderId}` }).catch(() => {});
  }
  if (current.runnerId && current.runnerId !== chosen) {
    notify(current.runnerId, { title: `Delivery ${dto.orderNumber} reassigned`, body: 'This delivery has been reassigned to someone else.', type: 'delivery', data: { orderId } }).catch(() => {});
  }
  return dto;
}

export async function listOrdersFor(where: ReturnType<typeof and>, limit = 50, offset = 0) {
  const rows = await db.select().from(schema.orders).where(where).orderBy(desc(schema.orders.createdAt)).limit(limit).offset(offset);
  return serializeOrders(rows);
}
