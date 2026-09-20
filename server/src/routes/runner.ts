import { Router } from 'express';
import { z } from 'zod';
import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { parse } from '../middleware/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { conflict, notFound } from '../lib/errors.js';
import { ACTIVE_ORDER_STATUSES } from '../lib/constants.js';
import { addEvent, broadcastOrder, getOrder, serializeOrders, transitionOrder } from '../lib/orders.js';
import { notify } from '../lib/notify.js';

export const runnerRouter = Router();
runnerRouter.use(requireAuth, requireRole('RUNNER'));

async function profile(userId: string) {
  let [p] = await db.select().from(schema.runnerProfiles).where(eq(schema.runnerProfiles.userId, userId)).limit(1);
  if (!p) [p] = await db.insert(schema.runnerProfiles).values({ userId }).returning();
  return p;
}

runnerRouter.get('/profile', async (req, res) => {
  const p = await profile(req.user!.id);
  const shops = await db
    .select({ id: schema.shops.id, name: schema.shops.name, category: schema.shops.category, logoUrl: schema.shops.logoUrl })
    .from(schema.shopRunners)
    .innerJoin(schema.shops, eq(schema.shops.id, schema.shopRunners.shopId))
    .where(eq(schema.shopRunners.runnerId, req.user!.id));
  res.json({ ...p, shops });
});

runnerRouter.patch('/profile', async (req, res) => {
  await profile(req.user!.id);
  const body = parse(z.object({ isAvailable: z.boolean().optional(), vehicleType: z.enum(['bike', 'scooter', 'car', 'bicycle', 'walk']).optional(), lat: z.number().optional(), lng: z.number().optional() }), req.body);
  const [p] = await db
    .update(schema.runnerProfiles)
    .set({ ...body, lastSeenAt: new Date().toISOString() })
    .where(eq(schema.runnerProfiles.userId, req.user!.id))
    .returning();
  res.json(p);
});

runnerRouter.post('/location', async (req, res) => {
  const body = parse(z.object({ lat: z.number(), lng: z.number() }), req.body);
  await profile(req.user!.id);
  await db.update(schema.runnerProfiles).set({ lat: body.lat, lng: body.lng, lastSeenAt: new Date().toISOString() }).where(eq(schema.runnerProfiles.userId, req.user!.id));
  res.json({ ok: true });
});

runnerRouter.get('/deliveries', async (req, res) => {
  const q = parse(z.object({ scope: z.enum(['active', 'past', 'all']).default('active'), limit: z.coerce.number().default(50) }), req.query);
  const conds = [eq(schema.orders.runnerId, req.user!.id)];
  if (q.scope === 'active') conds.push(inArray(schema.orders.status, ACTIVE_ORDER_STATUSES));
  if (q.scope === 'past') conds.push(inArray(schema.orders.status, ['DELIVERED', 'CANCELLED']));
  const rows = await db.select().from(schema.orders).where(and(...conds)).orderBy(desc(schema.orders.createdAt)).limit(q.limit);
  res.json(await serializeOrders(rows));
});

runnerRouter.get('/deliveries/:id', async (req, res) => {
  const order = await getOrder(req.params.id);
  if (order.runnerId !== req.user!.id) throw notFound('Delivery not found');
  res.json(order);
});

/** Runner status update: ON_THE_WAY (picked up) or DELIVERED. */
runnerRouter.post('/deliveries/:id/status', async (req, res) => {
  const body = parse(z.object({ status: z.enum(['ON_THE_WAY', 'DELIVERED']), note: z.string().trim().max(200).optional() }), req.body);
  const dto = await transitionOrder(req.params.id, body.status, { id: req.user!.id, role: 'RUNNER', name: req.user!.name }, { note: body.note });
  res.json(dto);
});

/** Runner declines an assignment before pickup → order goes back to the shop's queue. */
runnerRouter.post('/deliveries/:id/decline', async (req, res) => {
  const body = parse(z.object({ reason: z.string().trim().max(200).optional() }), req.body ?? {});
  const order = await getOrder(req.params.id);
  if (order.runnerId !== req.user!.id) throw notFound('Delivery not found');
  if (order.status === 'ON_THE_WAY' || order.status === 'DELIVERED') throw conflict('You cannot decline an order after picking it up');
  await db.update(schema.orders).set({ runnerId: null }).where(eq(schema.orders.id, order.id));
  await addEvent(order.id, order.status, { id: req.user!.id, role: 'RUNNER' }, `Runner declined${body.reason ? `: ${body.reason}` : ''}`);
  const dto = await getOrder(order.id);
  broadcastOrder(dto);
  notify(order.shop.ownerId, { title: `Runner declined ${order.orderNumber}`, body: `${req.user!.name} can't take this delivery${body.reason ? `: ${body.reason}` : ''}. Please assign another rider.`, type: 'delivery', data: { orderId: order.id }, url: `/merchant/orders/${order.id}` }).catch(() => {});
  res.json(dto);
});

runnerRouter.get('/earnings', async (req, res) => {
  const runnerId = req.user!.id;
  const since = new Date(Date.now() - 30 * 86400_000).toISOString();
  const rows = await db
    .select({ id: schema.orders.id, deliveryFee: schema.orders.deliveryFee, tip: schema.orders.tip, deliveredAt: schema.orders.deliveredAt, distanceKm: schema.orders.distanceKm, orderNumber: schema.orders.orderNumber, shopId: schema.orders.shopId })
    .from(schema.orders)
    .where(and(eq(schema.orders.runnerId, runnerId), eq(schema.orders.status, 'DELIVERED'), gte(schema.orders.deliveredAt, since)))
    .orderBy(desc(schema.orders.deliveredAt));
  const dayKey = (iso: string) => new Date(new Date(iso).getTime() + 5 * 3600_000).toISOString().slice(0, 10);
  const today = dayKey(new Date().toISOString());
  const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString();
  const sum = (list: typeof rows) => Math.round(list.reduce((a, r) => a + r.deliveryFee + r.tip, 0));
  const series: { date: string; amount: number; deliveries: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400_000 + 5 * 3600_000).toISOString().slice(0, 10);
    const dayRows = rows.filter((r) => r.deliveredAt && dayKey(r.deliveredAt) === d);
    series.push({ date: d, amount: sum(dayRows), deliveries: dayRows.length });
  }
  const [p] = await db.select().from(schema.runnerProfiles).where(eq(schema.runnerProfiles.userId, runnerId)).limit(1);
  res.json({
    today: { amount: sum(rows.filter((r) => r.deliveredAt && dayKey(r.deliveredAt) === today)), deliveries: rows.filter((r) => r.deliveredAt && dayKey(r.deliveredAt) === today).length },
    week: { amount: sum(rows.filter((r) => r.deliveredAt && r.deliveredAt >= weekAgo)), deliveries: rows.filter((r) => r.deliveredAt && r.deliveredAt >= weekAgo).length },
    month: { amount: sum(rows), deliveries: rows.length, distanceKm: Math.round(rows.reduce((a, r) => a + r.distanceKm, 0) * 10) / 10 },
    tips: Math.round(rows.reduce((a, r) => a + r.tip, 0)),
    series,
    rating: p?.ratingAvg ?? 0,
    ratingCount: p?.ratingCount ?? 0,
    totalDeliveries: p?.totalDeliveries ?? 0,
    recent: rows.slice(0, 20),
  });
});

void sql;
