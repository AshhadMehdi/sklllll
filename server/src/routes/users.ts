import { Router } from 'express';
import { z } from 'zod';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { parse } from '../middleware/validate.js';
import { requireAuth, toAuthUser } from '../middleware/auth.js';
import { notFound } from '../lib/errors.js';
import { getVapidPublicKey } from '../lib/push.js';

export const usersRouter = Router();
usersRouter.use(requireAuth);

// ───────────── Profile ─────────────
usersRouter.patch('/me', async (req, res) => {
  const body = parse(
    z.object({
      name: z.string().trim().min(2).max(80).optional(),
      phone: z.string().trim().max(20).nullable().optional(),
      avatarUrl: z.string().trim().max(500).nullable().optional(),
    }),
    req.body,
  );
  const [user] = await db.update(schema.users).set(body).where(eq(schema.users.id, req.user!.id)).returning();
  res.json({ user: toAuthUser(user) });
});

// ───────────── Addresses ─────────────
const addressSchema = z.object({
  label: z.string().trim().min(1).max(30).default('Home'),
  line1: z.string().trim().min(3, 'Enter the street / house details').max(200),
  area: z.string().trim().max(100).nullable().optional(),
  city: z.string().trim().min(2).max(60).default('Abbottabad'),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  instructions: z.string().trim().max(300).nullable().optional(),
  isDefault: z.boolean().optional(),
});

usersRouter.get('/me/addresses', async (req, res) => {
  const rows = await db.select().from(schema.addresses).where(eq(schema.addresses.userId, req.user!.id)).orderBy(desc(schema.addresses.isDefault), desc(schema.addresses.createdAt));
  res.json(rows);
});

usersRouter.post('/me/addresses', async (req, res) => {
  const body = parse(addressSchema, req.body);
  const userId = req.user!.id;
  const count = await db.select({ n: sql<number>`count(*)` }).from(schema.addresses).where(eq(schema.addresses.userId, userId));
  const makeDefault = body.isDefault || Number(count[0].n) === 0;
  if (makeDefault) await db.update(schema.addresses).set({ isDefault: false }).where(eq(schema.addresses.userId, userId));
  const [row] = await db.insert(schema.addresses).values({ ...body, userId, isDefault: makeDefault }).returning();
  res.status(201).json(row);
});

usersRouter.patch('/me/addresses/:id', async (req, res) => {
  const body = parse(addressSchema.partial(), req.body);
  const userId = req.user!.id;
  if (body.isDefault) await db.update(schema.addresses).set({ isDefault: false }).where(eq(schema.addresses.userId, userId));
  const [row] = await db.update(schema.addresses).set(body).where(and(eq(schema.addresses.id, req.params.id), eq(schema.addresses.userId, userId))).returning();
  if (!row) throw notFound('Address not found');
  res.json(row);
});

usersRouter.delete('/me/addresses/:id', async (req, res) => {
  await db.delete(schema.addresses).where(and(eq(schema.addresses.id, req.params.id), eq(schema.addresses.userId, req.user!.id)));
  res.json({ ok: true });
});

// ───────────── Favorites ─────────────
usersRouter.get('/me/favorites', async (req, res) => {
  const rows = await db
    .select({ shop: schema.shops })
    .from(schema.favorites)
    .innerJoin(schema.shops, eq(schema.shops.id, schema.favorites.shopId))
    .where(eq(schema.favorites.userId, req.user!.id))
    .orderBy(desc(schema.favorites.createdAt));
  res.json(rows.map((r) => r.shop));
});

usersRouter.post('/me/favorites/:shopId', async (req, res) => {
  const userId = req.user!.id;
  const shopId = req.params.shopId;
  const [existing] = await db.select().from(schema.favorites).where(and(eq(schema.favorites.userId, userId), eq(schema.favorites.shopId, shopId))).limit(1);
  if (existing) {
    await db.delete(schema.favorites).where(eq(schema.favorites.id, existing.id));
    return res.json({ favorite: false });
  }
  await db.insert(schema.favorites).values({ userId, shopId });
  res.json({ favorite: true });
});

// ───────────── Notifications ─────────────
usersRouter.get('/me/notifications', async (req, res) => {
  const rows = await db.select().from(schema.notifications).where(eq(schema.notifications.userId, req.user!.id)).orderBy(desc(schema.notifications.createdAt)).limit(100);
  const unread = rows.filter((r) => !r.isRead).length;
  res.json({ notifications: rows, unread });
});
usersRouter.post('/me/notifications/read-all', async (req, res) => {
  await db.update(schema.notifications).set({ isRead: true }).where(eq(schema.notifications.userId, req.user!.id));
  res.json({ ok: true });
});
usersRouter.post('/me/notifications/:id/read', async (req, res) => {
  await db.update(schema.notifications).set({ isRead: true }).where(and(eq(schema.notifications.id, req.params.id), eq(schema.notifications.userId, req.user!.id)));
  res.json({ ok: true });
});

// ───────────── Web Push ─────────────
usersRouter.get('/me/push/public-key', (_req, res) => res.json({ publicKey: getVapidPublicKey() }));
usersRouter.post('/me/push/subscribe', async (req, res) => {
  const body = parse(z.object({ endpoint: z.string().url(), keys: z.object({ p256dh: z.string(), auth: z.string() }) }), req.body);
  await db
    .insert(schema.pushSubscriptions)
    .values({ userId: req.user!.id, endpoint: body.endpoint, p256dh: body.keys.p256dh, auth: body.keys.auth })
    .onConflictDoUpdate({ target: schema.pushSubscriptions.endpoint, set: { userId: req.user!.id, p256dh: body.keys.p256dh, auth: body.keys.auth } });
  res.json({ ok: true });
});
usersRouter.post('/me/push/unsubscribe', async (req, res) => {
  const body = parse(z.object({ endpoint: z.string() }), req.body);
  await db.delete(schema.pushSubscriptions).where(and(eq(schema.pushSubscriptions.endpoint, body.endpoint), eq(schema.pushSubscriptions.userId, req.user!.id)));
  res.json({ ok: true });
});

// ───────────── Wallet ─────────────
usersRouter.get('/me/wallet', async (req, res) => {
  const [user] = await db.select({ walletPoints: schema.users.walletPoints }).from(schema.users).where(eq(schema.users.id, req.user!.id)).limit(1);
  const earned = await db
    .select({ id: schema.orders.id, orderNumber: schema.orders.orderNumber, pointsEarned: schema.orders.pointsEarned, total: schema.orders.total, paymentMethod: schema.orders.paymentMethod, paymentStatus: schema.orders.paymentStatus, createdAt: schema.orders.createdAt, deliveredAt: schema.orders.deliveredAt, shopId: schema.orders.shopId })
    .from(schema.orders)
    .where(and(eq(schema.orders.customerId, req.user!.id), sql`(${schema.orders.pointsEarned} > 0 or ${schema.orders.paymentMethod} = 'WALLET')`))
    .orderBy(desc(schema.orders.createdAt))
    .limit(50);
  res.json({ walletPoints: user.walletPoints, history: earned });
});
