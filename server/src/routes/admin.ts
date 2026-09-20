import { Router } from 'express';
import { z } from 'zod';
import { and, desc, eq, gte, inArray, like, or, sql } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { parse } from '../middleware/validate.js';
import { requireAuth, requireRole, toAuthUser } from '../middleware/auth.js';
import { notFound } from '../lib/errors.js';
import { ACTIVE_ORDER_STATUSES, DEFAULT_SETTINGS, ORDER_STATUSES, ROLES } from '../lib/constants.js';
import { getSettings, updateSettings } from '../lib/settings.js';
import { assignRunner, serializeOrders, transitionOrder } from '../lib/orders.js';
import { notify } from '../lib/notify.js';

export const adminRouter = Router();
adminRouter.use(requireAuth, requireRole('ADMIN'));

adminRouter.get('/stats', async (_req, res) => {
  const dayStart = new Date();
  dayStart.setUTCHours(dayStart.getUTCHours() - 5, 0, 0, 0); // approx local midnight (PKT)
  const since = new Date(Date.now() - 14 * 86400_000).toISOString();
  const [usersByRole, shopsByStatus, ordersByStatus, todayOrders, gmv, recentOrders, activeRunners] = await Promise.all([
    db.select({ role: schema.users.role, n: sql<number>`count(*)` }).from(schema.users).groupBy(schema.users.role),
    db.select({ status: schema.shops.status, n: sql<number>`count(*)` }).from(schema.shops).groupBy(schema.shops.status),
    db.select({ status: schema.orders.status, n: sql<number>`count(*)` }).from(schema.orders).groupBy(schema.orders.status),
    db.select({ n: sql<number>`count(*)`, total: sql<number>`coalesce(sum(${schema.orders.total}),0)` }).from(schema.orders).where(gte(schema.orders.createdAt, dayStart.toISOString())),
    db.select({ total: sql<number>`coalesce(sum(${schema.orders.subtotal}),0)`, fees: sql<number>`coalesce(sum(${schema.orders.serviceFee}),0)` }).from(schema.orders).where(eq(schema.orders.status, 'DELIVERED')),
    db.select().from(schema.orders).where(gte(schema.orders.createdAt, since)),
    db.select({ n: sql<number>`count(*)` }).from(schema.runnerProfiles).where(eq(schema.runnerProfiles.isAvailable, true)),
  ]);
  const settings = await getSettings();
  const dayKey = (iso: string) => new Date(new Date(iso).getTime() + 5 * 3600_000).toISOString().slice(0, 10);
  const series: { date: string; orders: number; gmv: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400_000 + 5 * 3600_000).toISOString().slice(0, 10);
    const dayRows = recentOrders.filter((o) => dayKey(o.createdAt) === d);
    series.push({ date: d, orders: dayRows.length, gmv: Math.round(dayRows.filter((o) => o.status !== 'CANCELLED').reduce((a, o) => a + o.subtotal, 0)) });
  }
  res.json({
    users: Object.fromEntries(ROLES.map((r) => [r, Number(usersByRole.find((u) => u.role === r)?.n ?? 0)])),
    shops: { PENDING: 0, APPROVED: 0, SUSPENDED: 0, ...Object.fromEntries(shopsByStatus.map((s) => [s.status, Number(s.n)])) },
    orders: Object.fromEntries(ORDER_STATUSES.map((s) => [s, Number(ordersByStatus.find((o) => o.status === s)?.n ?? 0)])),
    today: { orders: Number(todayOrders[0].n), value: Math.round(Number(todayOrders[0].total)) },
    gmv: Math.round(Number(gmv[0].total)),
    platformRevenue: Math.round(Number(gmv[0].fees) + (Number(gmv[0].total) * settings.commissionPct) / 100),
    activeRunners: Number(activeRunners[0].n),
    series,
  });
});

adminRouter.get('/shops', async (req, res) => {
  const q = parse(z.object({ status: z.string().optional(), q: z.string().optional() }), req.query);
  const conds = [];
  if (q.status && q.status !== 'all') conds.push(eq(schema.shops.status, q.status));
  if (q.q) conds.push(or(like(schema.shops.name, `%${q.q}%`), like(schema.shops.addressLine, `%${q.q}%`)));
  const rows = await db
    .select({ shop: schema.shops, ownerName: schema.users.name, ownerEmail: schema.users.email, ownerPhone: schema.users.phone, productCount: sql<number>`(select count(*) from products p where p.shop_id = ${schema.shops.id})`, orderCount: sql<number>`(select count(*) from orders o where o.shop_id = ${schema.shops.id})` })
    .from(schema.shops)
    .innerJoin(schema.users, eq(schema.users.id, schema.shops.ownerId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(schema.shops.createdAt))
    .limit(200);
  res.json(rows.map((r) => ({ ...r.shop, ownerName: r.ownerName, ownerEmail: r.ownerEmail, ownerPhone: r.ownerPhone, productCount: Number(r.productCount), orderCount: Number(r.orderCount) })));
});

adminRouter.patch('/shops/:id', async (req, res) => {
  const body = parse(z.object({ status: z.enum(['PENDING', 'APPROVED', 'SUSPENDED']).optional(), note: z.string().max(300).optional() }), req.body);
  const [shop] = await db.update(schema.shops).set({ status: body.status }).where(eq(schema.shops.id, req.params.id)).returning();
  if (!shop) throw notFound('Shop not found');
  if (body.status) {
    const msg = body.status === 'APPROVED' ? 'Your shop is now live on Qareeb. Customers nearby can order from you!' : body.status === 'SUSPENDED' ? `Your shop has been suspended${body.note ? `: ${body.note}` : ''}. Contact support for help.` : 'Your shop is pending review.';
    notify(shop.ownerId, { title: `Shop ${body.status.toLowerCase()}`, body: msg, type: 'system', url: '/merchant' }).catch(() => {});
  }
  res.json(shop);
});

adminRouter.get('/users', async (req, res) => {
  const q = parse(z.object({ role: z.string().optional(), q: z.string().optional() }), req.query);
  const conds = [];
  if (q.role && q.role !== 'all') conds.push(eq(schema.users.role, q.role));
  if (q.q) conds.push(or(like(schema.users.name, `%${q.q}%`), like(schema.users.email, `%${q.q}%`), like(schema.users.phone, `%${q.q}%`)));
  const rows = await db
    .select({ user: schema.users, orderCount: sql<number>`(select count(*) from orders o where o.customer_id = ${schema.users.id})` })
    .from(schema.users)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(schema.users.createdAt))
    .limit(300);
  res.json(rows.map((r) => ({ ...toAuthUser(r.user), orderCount: Number(r.orderCount) })));
});

adminRouter.patch('/users/:id', async (req, res) => {
  const body = parse(z.object({ isActive: z.boolean().optional(), role: z.enum(ROLES).optional(), walletPoints: z.number().int().min(0).optional() }), req.body);
  const [user] = await db.update(schema.users).set(body).where(eq(schema.users.id, req.params.id)).returning();
  if (!user) throw notFound('User not found');
  if (body.role === 'RUNNER') await db.insert(schema.runnerProfiles).values({ userId: user.id }).onConflictDoNothing();
  res.json(toAuthUser(user));
});

adminRouter.get('/orders', async (req, res) => {
  const q = parse(z.object({ scope: z.enum(['active', 'past', 'all']).default('all'), status: z.enum(ORDER_STATUSES).optional(), limit: z.coerce.number().default(100) }), req.query);
  const conds = [];
  if (q.status) conds.push(eq(schema.orders.status, q.status));
  else if (q.scope === 'active') conds.push(inArray(schema.orders.status, ACTIVE_ORDER_STATUSES));
  else if (q.scope === 'past') conds.push(inArray(schema.orders.status, ['DELIVERED', 'CANCELLED']));
  const rows = await db
    .select()
    .from(schema.orders)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(schema.orders.createdAt))
    .limit(q.limit);
  res.json(await serializeOrders(rows));
});

adminRouter.post('/orders/:id/status', async (req, res) => {
  const body = parse(z.object({ status: z.enum(ORDER_STATUSES), reason: z.string().max(200).optional() }), req.body);
  res.json(await transitionOrder(req.params.id, body.status, { id: req.user!.id, role: 'ADMIN', name: req.user!.name }, { reason: body.reason }));
});

adminRouter.post('/orders/:id/assign', async (req, res) => {
  const body = parse(z.object({ runnerId: z.union([z.string(), z.literal('auto'), z.null()]) }), req.body);
  res.json(await assignRunner(req.params.id, body.runnerId, { id: req.user!.id, role: 'ADMIN', name: req.user!.name }, []));
});

adminRouter.get('/settings', async (_req, res) => res.json({ settings: await getSettings(), defaults: DEFAULT_SETTINGS }));
adminRouter.patch('/settings', async (req, res) => {
  const body = parse(
    z.object({
      serviceFee: z.number().min(0).max(1000).optional(),
      commissionPct: z.number().min(0).max(50).optional(),
      pointsRatePct: z.number().min(0).max(20).optional(),
      allowPlatformRunners: z.boolean().optional(),
      maxDeliveryRadiusKm: z.number().min(1).max(100).optional(),
      customerCancelWindowMin: z.number().min(0).max(60).optional(),
      cityName: z.string().min(2).max(60).optional(),
      cityLat: z.number().optional(),
      cityLng: z.number().optional(),
    }),
    req.body,
  );
  res.json({ settings: await updateSettings(body) });
});

adminRouter.get('/promos', async (_req, res) => {
  const rows = await db.select({ promo: schema.promos, shopName: schema.shops.name }).from(schema.promos).leftJoin(schema.shops, eq(schema.shops.id, schema.promos.shopId)).orderBy(desc(schema.promos.createdAt));
  res.json(rows.map((r) => ({ ...r.promo, shopName: r.shopName })));
});
adminRouter.post('/promos', async (req, res) => {
  const body = parse(
    z.object({ code: z.string().trim().toUpperCase().min(3).max(20), type: z.enum(['PERCENT', 'FIXED', 'FREE_DELIVERY']), value: z.number().min(0).default(0), minOrder: z.number().min(0).default(0), maxDiscount: z.number().nullable().optional(), expiresAt: z.string().nullable().optional(), usageLimit: z.number().int().nullable().optional(), isActive: z.boolean().default(true) }),
    req.body,
  );
  const [row] = await db.insert(schema.promos).values({ ...body, shopId: null }).returning();
  res.status(201).json(row);
});
adminRouter.patch('/promos/:id', async (req, res) => {
  const body = parse(z.object({ isActive: z.boolean().optional() }), req.body);
  const [row] = await db.update(schema.promos).set(body).where(eq(schema.promos.id, req.params.id)).returning();
  if (!row) throw notFound('Promo not found');
  res.json(row);
});
adminRouter.post('/broadcast', async (req, res) => {
  const body = parse(z.object({ title: z.string().min(2).max(80), body: z.string().min(2).max(300), role: z.enum(ROLES).optional() }), req.body);
  const targets = await db.select({ id: schema.users.id }).from(schema.users).where(and(eq(schema.users.isActive, true), body.role ? eq(schema.users.role, body.role) : undefined));
  await Promise.all(targets.map((t) => notify(t.id, { title: body.title, body: body.body, type: 'promo' })));
  res.json({ ok: true, sent: targets.length });
});
