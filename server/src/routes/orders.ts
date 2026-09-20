import { Router } from 'express';
import { z } from 'zod';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { parse } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js';
import { ACTIVE_ORDER_STATUSES, PAYMENT_METHODS } from '../lib/constants.js';
import { buildQuote, getOrder, placeOrders, transitionOrder, type OrderDTO } from '../lib/orders.js';
import { serializeOrders } from '../lib/orders.js';
import { emitToOrder, emitToShop, emitToUser } from '../socket.js';
import { notify } from '../lib/notify.js';

export const ordersRouter = Router();
ordersRouter.use(requireAuth);

const addressSchema = z.object({
  label: z.string().trim().max(30).default('Home'),
  line1: z.string().trim().min(3).max(200),
  area: z.string().trim().max(100).nullable().optional(),
  city: z.string().trim().max(60).default('Abbottabad'),
  lat: z.number(),
  lng: z.number(),
  instructions: z.string().trim().max(300).nullable().optional(),
  phone: z.string().trim().max(20).nullable().optional(),
});

const cartSchema = z.object({
  addressId: z.string().optional(),
  address: addressSchema.optional(),
  shops: z
    .array(
      z.object({
        shopId: z.string(),
        notes: z.string().trim().max(300).optional(),
        items: z.array(z.object({ productId: z.string(), quantity: z.number().int().min(1).max(99), note: z.string().trim().max(120).optional() })).min(1),
      }),
    )
    .min(1, 'Your cart is empty')
    .max(6, 'You can order from up to 6 shops at once'),
  promoCode: z.string().trim().max(30).nullable().optional(),
  tip: z.number().min(0).max(5000).optional(),
});

async function resolveAddress(userId: string, input: z.infer<typeof cartSchema>) {
  if (input.address) return input.address;
  if (input.addressId) {
    const [a] = await db.select().from(schema.addresses).where(and(eq(schema.addresses.id, input.addressId), eq(schema.addresses.userId, userId))).limit(1);
    if (!a) throw notFound('Delivery address not found');
    return { label: a.label, line1: a.line1, area: a.area, city: a.city, lat: a.lat, lng: a.lng, instructions: a.instructions };
  }
  throw badRequest('Choose a delivery address');
}

// ───────────── Checkout ─────────────
ordersRouter.post('/quote', async (req, res) => {
  const body = parse(cartSchema, req.body);
  const address = await resolveAddress(req.user!.id, body);
  const quote = await buildQuote({ address, shops: body.shops, promoCode: body.promoCode, tip: body.tip });
  res.json({ ...quote, walletPoints: req.user!.walletPoints });
});

ordersRouter.post('/checkout', async (req, res) => {
  const body = parse(cartSchema.extend({ paymentMethod: z.enum(PAYMENT_METHODS), notes: z.string().trim().max(300).optional(), scheduledFor: z.string().datetime().nullable().optional() }), req.body);
  const address = await resolveAddress(req.user!.id, body);
  const orders = await placeOrders(req.user!.id, { ...body, address });
  res.status(201).json({ orders, groupId: orders[0]?.groupId });
});

// ───────────── My orders ─────────────
ordersRouter.get('/', async (req, res) => {
  const q = parse(z.object({ scope: z.enum(['active', 'past', 'all']).default('all'), limit: z.coerce.number().default(50) }), req.query);
  const conds = [eq(schema.orders.customerId, req.user!.id)];
  if (q.scope === 'active') conds.push(inArray(schema.orders.status, ACTIVE_ORDER_STATUSES));
  if (q.scope === 'past') conds.push(inArray(schema.orders.status, ['DELIVERED', 'CANCELLED']));
  const rows = await db.select().from(schema.orders).where(and(...conds)).orderBy(desc(schema.orders.createdAt)).limit(q.limit);
  res.json(await serializeOrders(rows));
});

async function loadAccessibleOrder(req: { user?: { id: string; role: string } }, orderId: string): Promise<OrderDTO> {
  const order = await getOrder(orderId);
  const user = req.user!;
  if (user.role === 'ADMIN' || order.customerId === user.id || order.runnerId === user.id) return order;
  if (user.role === 'MERCHANT') {
    const [shop] = await db.select({ id: schema.shops.id }).from(schema.shops).where(and(eq(schema.shops.id, order.shopId), eq(schema.shops.ownerId, user.id))).limit(1);
    if (shop) return order;
  }
  throw forbidden('You do not have access to this order');
}

ordersRouter.get('/:id', async (req, res) => {
  res.json(await loadAccessibleOrder(req, req.params.id));
});

ordersRouter.post('/:id/cancel', async (req, res) => {
  const body = parse(z.object({ reason: z.string().trim().max(200).optional() }), req.body ?? {});
  const order = await loadAccessibleOrder(req, req.params.id);
  const shopIds = req.user!.role === 'MERCHANT' ? [order.shopId] : [];
  const dto = await transitionOrder(order.id, 'CANCELLED', { id: req.user!.id, role: req.user!.role, name: req.user!.name }, { reason: body.reason ?? 'Cancelled by customer', shopIds });
  res.json(dto);
});

// ───────────── Reviews ─────────────
ordersRouter.post('/:id/review', async (req, res) => {
  const body = parse(z.object({ shopRating: z.number().int().min(1).max(5), runnerRating: z.number().int().min(1).max(5).nullable().optional(), comment: z.string().trim().max(500).nullable().optional() }), req.body);
  const order = await loadAccessibleOrder(req, req.params.id);
  if (order.customerId !== req.user!.id) throw forbidden('Only the customer can review this order');
  if (order.status !== 'DELIVERED') throw conflict('You can review an order once it has been delivered');
  if (order.review) throw conflict('You already reviewed this order');
  await db.transaction(async (tx) => {
    await tx.insert(schema.reviews).values({ orderId: order.id, shopId: order.shopId, runnerId: order.runnerId, customerId: order.customerId, shopRating: body.shopRating, runnerRating: order.runnerId ? (body.runnerRating ?? null) : null, comment: body.comment ?? null });
    const [agg] = await tx.select({ avg: sql<number>`avg(${schema.reviews.shopRating})`, n: sql<number>`count(*)` }).from(schema.reviews).where(eq(schema.reviews.shopId, order.shopId));
    await tx.update(schema.shops).set({ ratingAvg: Math.round(Number(agg.avg) * 10) / 10, ratingCount: Number(agg.n) }).where(eq(schema.shops.id, order.shopId));
    if (order.runnerId && body.runnerRating) {
      const [ragg] = await tx.select({ avg: sql<number>`avg(${schema.reviews.runnerRating})`, n: sql<number>`count(${schema.reviews.runnerRating})` }).from(schema.reviews).where(eq(schema.reviews.runnerId, order.runnerId));
      await tx.update(schema.runnerProfiles).set({ ratingAvg: Math.round(Number(ragg.avg) * 10) / 10, ratingCount: Number(ragg.n) }).where(eq(schema.runnerProfiles.userId, order.runnerId));
    }
  });
  const dto = await getOrder(order.id);
  emitToShop(order.shopId, 'order:updated', dto);
  notify(order.shop.ownerId, { title: `${body.shopRating}★ review on ${order.orderNumber}`, body: body.comment || `${order.customer.name} rated their order ${body.shopRating} out of 5`, type: 'order', data: { orderId: order.id }, url: `/merchant/orders/${order.id}` }).catch(() => {});
  res.status(201).json(dto);
});

// ───────────── Chat ─────────────
ordersRouter.get('/:id/messages', async (req, res) => {
  const order = await loadAccessibleOrder(req, req.params.id);
  const rows = await db
    .select({ message: schema.messages, senderName: schema.users.name, senderAvatar: schema.users.avatarUrl })
    .from(schema.messages)
    .innerJoin(schema.users, eq(schema.users.id, schema.messages.senderId))
    .where(eq(schema.messages.orderId, order.id))
    .orderBy(schema.messages.createdAt)
    .limit(200);
  res.json(rows.map((r) => ({ ...r.message, senderName: r.senderName, senderAvatar: r.senderAvatar })));
});

ordersRouter.post('/:id/messages', async (req, res) => {
  const body = parse(z.object({ body: z.string().trim().min(1).max(1000) }), req.body);
  const order = await loadAccessibleOrder(req, req.params.id);
  const user = req.user!;
  const role = order.customerId === user.id ? 'CUSTOMER' : order.runnerId === user.id ? 'RUNNER' : user.role === 'ADMIN' ? 'ADMIN' : 'MERCHANT';
  const [row] = await db.insert(schema.messages).values({ orderId: order.id, senderId: user.id, senderRole: role, body: body.body }).returning();
  const payload = { ...row, senderName: user.name, senderAvatar: user.avatarUrl };
  emitToOrder(order.id, 'chat:message', payload);
  const recipients = [order.customerId, order.runnerId, order.shop.ownerId].filter((id): id is string => !!id && id !== user.id);
  for (const rid of recipients) {
    emitToUser(rid, 'chat:message', payload);
    notify(rid, { title: `${user.name} · ${order.orderNumber}`, body: body.body.slice(0, 120), type: 'chat', data: { orderId: order.id }, url: rid === order.customerId ? `/orders/${order.id}` : rid === order.runnerId ? `/runner/deliveries/${order.id}` : `/merchant/orders/${order.id}` }).catch(() => {});
  }
  res.status(201).json(payload);
});
