import { Router, type Request } from 'express';
import { z } from 'zod';
import { and, asc, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { parse } from '../middleware/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js';
import { ACTIVE_ORDER_STATUSES, ORDER_STATUSES, PRODUCT_UNITS, SHOP_CATEGORIES } from '../lib/constants.js';
import { DEFAULT_HOURS, haversineKm, round1 } from '../lib/geo.js';
import { assignRunner, serializeOrders, transitionOrder } from '../lib/orders.js';
import { decorateShop } from './shops.js';
import { emitToShop } from '../socket.js';
import { notify } from '../lib/notify.js';
import { getSettings } from '../lib/settings.js';

export const merchantRouter = Router();
merchantRouter.use(requireAuth, requireRole('MERCHANT'));

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 50);

async function myShop(req: Request, required = true) {
  const [shop] = await db.select().from(schema.shops).where(eq(schema.shops.ownerId, req.user!.id)).limit(1);
  if (!shop && required) throw notFound('You have not set up your shop yet');
  return shop ?? null;
}

const hoursSchema = z.record(z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']), z.object({ open: z.string().regex(/^\d{2}:\d{2}$/), close: z.string().regex(/^\d{2}:\d{2}$/), closed: z.boolean().optional() }));

const shopSchema = z.object({
  name: z.string().trim().min(2).max(80),
  category: z.enum(SHOP_CATEGORIES.map((c) => c.id) as [string, ...string[]]),
  description: z.string().trim().max(600).nullable().optional(),
  phone: z.string().trim().max(20).nullable().optional(),
  logoUrl: z.string().trim().max(500).nullable().optional(),
  coverUrl: z.string().trim().max(500).nullable().optional(),
  addressLine: z.string().trim().min(3).max(200),
  lat: z.number(),
  lng: z.number(),
  hours: hoursSchema.optional(),
  prepTimeMin: z.number().int().min(0).max(240).optional(),
  minOrder: z.number().min(0).max(100000).optional(),
  tags: z.array(z.string().trim().max(30)).max(10).optional(),
  isOpen: z.boolean().optional(),
});

// ───────────── Shop ─────────────
merchantRouter.get('/shop', async (req, res) => {
  const shop = await myShop(req, false);
  if (!shop) return res.json(null);
  const zones = await db.select().from(schema.deliveryZones).where(eq(schema.deliveryZones.shopId, shop.id)).orderBy(asc(schema.deliveryZones.radiusKm));
  res.json(decorateShop(shop, zones));
});

merchantRouter.post('/shop', async (req, res) => {
  if (await myShop(req, false)) throw conflict('You already have a shop. Edit it instead.');
  const body = parse(shopSchema, req.body);
  let slug = slugify(body.name) || 'shop';
  const clash = await db.select({ id: schema.shops.id }).from(schema.shops).where(eq(schema.shops.slug, slug)).limit(1);
  if (clash.length) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
  const [shop] = await db
    .insert(schema.shops)
    .values({ ...body, slug, ownerId: req.user!.id, hours: (body.hours as schema.ShopHours) ?? DEFAULT_HOURS, status: 'APPROVED', tags: body.tags ?? [] })
    .returning();
  // Sensible default delivery rings
  await db.insert(schema.deliveryZones).values([
    { shopId: shop.id, name: 'Nearby', radiusKm: 2, fee: 60, freeAbove: 1500, sortOrder: 0 },
    { shopId: shop.id, name: 'City', radiusKm: 5, fee: 120, freeAbove: null, sortOrder: 1 },
    { shopId: shop.id, name: 'Outskirts', radiusKm: 8, fee: 200, freeAbove: null, sortOrder: 2 },
  ]);
  res.status(201).json(shop);
});

merchantRouter.patch('/shop', async (req, res) => {
  const shop = await myShop(req);
  const body = parse(shopSchema.partial(), req.body);
  const [updated] = await db
    .update(schema.shops)
    .set({ ...body, hours: body.hours as schema.ShopHours | undefined })
    .where(eq(schema.shops.id, shop!.id))
    .returning();
  emitToShop(shop!.id, 'shop:updated', updated);
  res.json(updated);
});

// ───────────── Delivery zones ─────────────
const zoneSchema = z.object({ name: z.string().trim().min(1).max(40), radiusKm: z.number().min(0.2).max(50), fee: z.number().min(0).max(5000), freeAbove: z.number().min(0).nullable().optional() });

merchantRouter.put('/zones', async (req, res) => {
  const shop = await myShop(req);
  const body = parse(z.array(zoneSchema).min(1).max(6), req.body);
  const settings = await getSettings();
  if (body.some((z) => z.radiusKm > settings.maxDeliveryRadiusKm)) throw badRequest(`Delivery radius cannot exceed ${settings.maxDeliveryRadiusKm} km`);
  await db.transaction(async (tx) => {
    await tx.delete(schema.deliveryZones).where(eq(schema.deliveryZones.shopId, shop!.id));
    await tx.insert(schema.deliveryZones).values(body.sort((a, b) => a.radiusKm - b.radiusKm).map((z, i) => ({ ...z, shopId: shop!.id, sortOrder: i })));
  });
  res.json(await db.select().from(schema.deliveryZones).where(eq(schema.deliveryZones.shopId, shop!.id)).orderBy(asc(schema.deliveryZones.radiusKm)));
});

// ───────────── Products ─────────────
const productSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).nullable().optional(),
  category: z.string().trim().min(1).max(40).default('General'),
  unit: z.enum(PRODUCT_UNITS).default('piece'),
  price: z.number().min(0).max(1_000_000),
  compareAtPrice: z.number().min(0).nullable().optional(),
  imageUrl: z.string().trim().max(500).nullable().optional(),
  emoji: z.string().trim().max(8).nullable().optional(),
  stock: z.number().int().min(0).max(100000).default(0),
  isAvailable: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  sortOrder: z.number().int().optional(),
});

merchantRouter.get('/products', async (req, res) => {
  const shop = await myShop(req);
  const rows = await db.select().from(schema.products).where(eq(schema.products.shopId, shop!.id)).orderBy(asc(schema.products.category), asc(schema.products.sortOrder), asc(schema.products.name));
  res.json(rows);
});

merchantRouter.post('/products', async (req, res) => {
  const shop = await myShop(req);
  const body = parse(productSchema, req.body);
  const [row] = await db.insert(schema.products).values({ ...body, shopId: shop!.id }).returning();
  res.status(201).json(row);
});

merchantRouter.patch('/products/:id', async (req, res) => {
  const shop = await myShop(req);
  const body = parse(productSchema.partial(), req.body);
  const [row] = await db.update(schema.products).set(body).where(and(eq(schema.products.id, req.params.id), eq(schema.products.shopId, shop!.id))).returning();
  if (!row) throw notFound('Product not found');
  res.json(row);
});

merchantRouter.delete('/products/:id', async (req, res) => {
  const shop = await myShop(req);
  await db.delete(schema.products).where(and(eq(schema.products.id, req.params.id), eq(schema.products.shopId, shop!.id)));
  res.json({ ok: true });
});

/** Bulk stock / availability update: [{ id, stock?, isAvailable? }] */
merchantRouter.post('/products/bulk', async (req, res) => {
  const shop = await myShop(req);
  const body = parse(z.array(z.object({ id: z.string(), stock: z.number().int().min(0).optional(), isAvailable: z.boolean().optional(), price: z.number().min(0).optional() })).min(1).max(200), req.body);
  await db.transaction(async (tx) => {
    for (const item of body) {
      const { id, ...patch } = item;
      await tx.update(schema.products).set(patch).where(and(eq(schema.products.id, id), eq(schema.products.shopId, shop!.id)));
    }
  });
  res.json({ ok: true, updated: body.length });
});

// ───────────── Orders ─────────────
merchantRouter.get('/orders', async (req, res) => {
  const shop = await myShop(req);
  const q = parse(z.object({ scope: z.enum(['active', 'new', 'past', 'all']).default('active'), status: z.enum(ORDER_STATUSES).optional(), limit: z.coerce.number().default(100) }), req.query);
  const conds = [eq(schema.orders.shopId, shop!.id)];
  if (q.status) conds.push(eq(schema.orders.status, q.status));
  else if (q.scope === 'active') conds.push(inArray(schema.orders.status, ACTIVE_ORDER_STATUSES));
  else if (q.scope === 'new') conds.push(eq(schema.orders.status, 'PENDING'));
  else if (q.scope === 'past') conds.push(inArray(schema.orders.status, ['DELIVERED', 'CANCELLED']));
  const rows = await db.select().from(schema.orders).where(and(...conds)).orderBy(desc(schema.orders.createdAt)).limit(q.limit);
  res.json(await serializeOrders(rows));
});

merchantRouter.post('/orders/:id/status', async (req, res) => {
  const shop = await myShop(req);
  const body = parse(z.object({ status: z.enum(ORDER_STATUSES), note: z.string().trim().max(200).optional(), reason: z.string().trim().max(200).optional() }), req.body);
  const dto = await transitionOrder(req.params.id, body.status, { id: req.user!.id, role: 'MERCHANT', name: req.user!.name }, { note: body.note, reason: body.reason, shopIds: [shop!.id] });
  res.json(dto);
});

merchantRouter.post('/orders/:id/assign', async (req, res) => {
  const shop = await myShop(req);
  const body = parse(z.object({ runnerId: z.union([z.string(), z.literal('auto'), z.null()]) }), req.body);
  const dto = await assignRunner(req.params.id, body.runnerId, { id: req.user!.id, role: 'MERCHANT', name: req.user!.name }, [shop!.id]);
  res.json(dto);
});

// ───────────── Runners ─────────────
merchantRouter.get('/runners', async (req, res) => {
  const shop = await myShop(req);
  const settings = await getSettings();
  const own = await db
    .select({ user: schema.users, profile: schema.runnerProfiles })
    .from(schema.shopRunners)
    .innerJoin(schema.users, eq(schema.users.id, schema.shopRunners.runnerId))
    .leftJoin(schema.runnerProfiles, eq(schema.runnerProfiles.userId, schema.users.id))
    .where(eq(schema.shopRunners.shopId, shop!.id));
  const ownIds = new Set(own.map((o) => o.user.id));
  const platform = settings.allowPlatformRunners
    ? await db
        .select({ user: schema.users, profile: schema.runnerProfiles })
        .from(schema.runnerProfiles)
        .innerJoin(schema.users, eq(schema.users.id, schema.runnerProfiles.userId))
        .where(and(eq(schema.runnerProfiles.isAvailable, true), eq(schema.users.isActive, true)))
    : [];
  const loads = await db
    .select({ runnerId: schema.orders.runnerId, n: sql<number>`count(*)` })
    .from(schema.orders)
    .where(and(inArray(schema.orders.status, ACTIVE_ORDER_STATUSES), sql`${schema.orders.runnerId} is not null`))
    .groupBy(schema.orders.runnerId);
  const loadMap = new Map(loads.map((l) => [l.runnerId, Number(l.n)]));
  const toDto = (r: { user: schema.User; profile: schema.RunnerProfile | null }, mine: boolean) => ({
    id: r.user.id,
    name: r.user.name,
    phone: r.user.phone,
    email: r.user.email,
    avatarUrl: r.user.avatarUrl,
    vehicleType: r.profile?.vehicleType ?? 'bike',
    isAvailable: r.profile?.isAvailable ?? false,
    ratingAvg: r.profile?.ratingAvg ?? 0,
    totalDeliveries: r.profile?.totalDeliveries ?? 0,
    lastSeenAt: r.profile?.lastSeenAt ?? null,
    distanceKm: r.profile?.lat != null && r.profile?.lng != null ? round1(haversineKm(r.profile.lat, r.profile.lng, shop!.lat, shop!.lng)) : null,
    activeDeliveries: loadMap.get(r.user.id) ?? 0,
    mine,
  });
  res.json({ mine: own.map((r) => toDto(r, true)), available: platform.filter((r) => !ownIds.has(r.user.id)).map((r) => toDto(r, false)) });
});

merchantRouter.post('/runners', async (req, res) => {
  const shop = await myShop(req);
  const body = parse(z.object({ email: z.string().trim().toLowerCase().email().optional(), phone: z.string().trim().optional(), runnerId: z.string().optional() }), req.body);
  const conds = body.runnerId ? eq(schema.users.id, body.runnerId) : body.email ? eq(schema.users.email, body.email) : body.phone ? eq(schema.users.phone, body.phone) : null;
  if (!conds) throw badRequest('Provide the runner\'s email, phone or id');
  const [user] = await db.select().from(schema.users).where(and(conds, eq(schema.users.role, 'RUNNER'))).limit(1);
  if (!user) throw notFound('No runner account found with those details. Ask them to sign up as a Rider first.');
  await db.insert(schema.shopRunners).values({ shopId: shop!.id, runnerId: user.id }).onConflictDoNothing();
  notify(user.id, { title: `${shop!.name} added you as a rider`, body: 'You will now receive delivery assignments from this shop.', type: 'system' }).catch(() => {});
  res.status(201).json({ ok: true, runner: { id: user.id, name: user.name, phone: user.phone } });
});

merchantRouter.delete('/runners/:runnerId', async (req, res) => {
  const shop = await myShop(req);
  await db.delete(schema.shopRunners).where(and(eq(schema.shopRunners.shopId, shop!.id), eq(schema.shopRunners.runnerId, req.params.runnerId)));
  res.json({ ok: true });
});

// ───────────── Promos ─────────────
const promoSchema = z.object({
  code: z.string().trim().toUpperCase().min(3).max(20).regex(/^[A-Z0-9]+$/, 'Letters and numbers only'),
  type: z.enum(['PERCENT', 'FIXED', 'FREE_DELIVERY']),
  value: z.number().min(0).default(0),
  minOrder: z.number().min(0).default(0),
  maxDiscount: z.number().min(0).nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  usageLimit: z.number().int().min(1).nullable().optional(),
  isActive: z.boolean().default(true),
});

merchantRouter.get('/promos', async (req, res) => {
  const shop = await myShop(req);
  res.json(await db.select().from(schema.promos).where(eq(schema.promos.shopId, shop!.id)).orderBy(desc(schema.promos.createdAt)));
});
merchantRouter.post('/promos', async (req, res) => {
  const shop = await myShop(req);
  const body = parse(promoSchema, req.body);
  const [exists] = await db.select({ id: schema.promos.id }).from(schema.promos).where(eq(schema.promos.code, body.code)).limit(1);
  if (exists) throw conflict('That promo code is already taken');
  const [row] = await db.insert(schema.promos).values({ ...body, shopId: shop!.id }).returning();
  res.status(201).json(row);
});
merchantRouter.patch('/promos/:id', async (req, res) => {
  const shop = await myShop(req);
  const body = parse(promoSchema.partial(), req.body);
  const [row] = await db.update(schema.promos).set(body).where(and(eq(schema.promos.id, req.params.id), eq(schema.promos.shopId, shop!.id))).returning();
  if (!row) throw notFound('Promo not found');
  res.json(row);
});
merchantRouter.delete('/promos/:id', async (req, res) => {
  const shop = await myShop(req);
  await db.delete(schema.promos).where(and(eq(schema.promos.id, req.params.id), eq(schema.promos.shopId, shop!.id)));
  res.json({ ok: true });
});

// ───────────── Analytics ─────────────
merchantRouter.get('/analytics', async (req, res) => {
  const shop = await myShop(req);
  const settings = await getSettings();
  const days = Math.min(90, Math.max(7, Number(req.query.days ?? 14)));
  const since = new Date(Date.now() - days * 86400_000);
  since.setUTCHours(0, 0, 0, 0);
  const sinceIso = since.toISOString();
  const rows = await db.select().from(schema.orders).where(and(eq(schema.orders.shopId, shop!.id), gte(schema.orders.createdAt, sinceIso)));
  const delivered = rows.filter((o) => o.status === 'DELIVERED');
  const todayKey = new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10); // PKT
  const dayKey = (iso: string) => new Date(new Date(iso).getTime() + 5 * 3600_000).toISOString().slice(0, 10);
  const series: { date: string; revenue: number; orders: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400_000 + 5 * 3600_000).toISOString().slice(0, 10);
    const dayOrders = rows.filter((o) => dayKey(o.createdAt) === d);
    series.push({ date: d, revenue: Math.round(dayOrders.filter((o) => o.status === 'DELIVERED').reduce((a, o) => a + o.subtotal, 0)), orders: dayOrders.length });
  }
  const itemRows = delivered.length ? await db.select().from(schema.orderItems).where(inArray(schema.orderItems.orderId, delivered.map((o) => o.id))) : [];
  const topMap = new Map<string, { name: string; quantity: number; revenue: number; emoji: string | null }>();
  for (const it of itemRows) {
    const cur = topMap.get(it.name) ?? { name: it.name, quantity: 0, revenue: 0, emoji: it.emoji };
    cur.quantity += it.quantity;
    cur.revenue += it.total;
    topMap.set(it.name, cur);
  }
  const lowStock = await db.select().from(schema.products).where(and(eq(schema.products.shopId, shop!.id), sql`${schema.products.stock} <= 5`)).limit(20);
  const statusCounts = ORDER_STATUSES.map((s) => ({ status: s, count: rows.filter((o) => o.status === s).length }));
  const revenue = delivered.reduce((a, o) => a + o.subtotal, 0);
  const todayOrders = rows.filter((o) => dayKey(o.createdAt) === todayKey);
  res.json({
    days,
    totals: {
      revenue: Math.round(revenue),
      commission: Math.round((revenue * settings.commissionPct) / 100),
      netPayout: Math.round(revenue - (revenue * settings.commissionPct) / 100),
      orders: rows.length,
      delivered: delivered.length,
      cancelled: rows.filter((o) => o.status === 'CANCELLED').length,
      avgOrderValue: delivered.length ? Math.round(revenue / delivered.length) : 0,
      rating: shop!.ratingAvg,
      ratingCount: shop!.ratingCount,
    },
    today: { orders: todayOrders.length, revenue: Math.round(todayOrders.filter((o) => o.status === 'DELIVERED').reduce((a, o) => a + o.subtotal, 0)), pending: todayOrders.filter((o) => o.status === 'PENDING').length },
    series,
    topProducts: [...topMap.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 8),
    statusCounts,
    lowStock,
  });
});

void forbidden;
