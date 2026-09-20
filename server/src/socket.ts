import type { Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import { and, eq, inArray } from 'drizzle-orm';
import { db, schema } from './db/index.js';
import { loadUser, verifyToken, type AuthUser } from './middleware/auth.js';
import { ACTIVE_ORDER_STATUSES } from './lib/constants.js';

let io: Server | null = null;

export const getIO = () => {
  if (!io) throw new Error('Socket.io not initialised');
  return io;
};

export const rooms = {
  user: (id: string) => `user:${id}`,
  shop: (id: string) => `shop:${id}`,
  order: (id: string) => `order:${id}`,
  runners: 'runners',
  admins: 'admins',
};

interface SocketData {
  user: AuthUser;
  shopIds: string[];
}

async function canAccessOrder(user: AuthUser, orderId: string, shopIds: string[]) {
  const [order] = await db.select({ customerId: schema.orders.customerId, shopId: schema.orders.shopId, runnerId: schema.orders.runnerId }).from(schema.orders).where(eq(schema.orders.id, orderId)).limit(1);
  if (!order) return false;
  if (user.role === 'ADMIN') return true;
  return order.customerId === user.id || order.runnerId === user.id || shopIds.includes(order.shopId);
}

export function initSocket(httpServer: HttpServer, corsOrigins: string[] | boolean) {
  io = new Server(httpServer, {
    cors: { origin: corsOrigins, credentials: true },
    path: '/socket.io',
    transports: ['websocket', 'polling'],
  });

  io.use(async (socket, next) => {
    const token = (socket.handshake.auth?.token as string | undefined) || (socket.handshake.query?.token as string | undefined);
    const userId = token ? verifyToken(token) : null;
    const user = userId ? await loadUser(userId) : null;
    if (!user) return next(new Error('unauthorized'));
    const shopIds = user.role === 'MERCHANT' || user.role === 'ADMIN' ? (await db.select({ id: schema.shops.id }).from(schema.shops).where(eq(schema.shops.ownerId, user.id))).map((s) => s.id) : [];
    (socket.data as SocketData) = { user, shopIds };
    next();
  });

  io.on('connection', (socket: Socket) => {
    const { user, shopIds } = socket.data as SocketData;
    socket.join(rooms.user(user.id));
    shopIds.forEach((id) => socket.join(rooms.shop(id)));
    if (user.role === 'RUNNER') socket.join(rooms.runners);
    if (user.role === 'ADMIN') socket.join(rooms.admins);

    socket.on('order:join', async (orderId: string, ack?: (ok: boolean) => void) => {
      const ok = typeof orderId === 'string' && (await canAccessOrder(user, orderId, shopIds));
      if (ok) socket.join(rooms.order(orderId));
      ack?.(ok);
    });
    socket.on('order:leave', (orderId: string) => socket.leave(rooms.order(orderId)));

    // Runners stream their GPS position; we fan it out to every active order they carry.
    socket.on('runner:location', async (loc: { lat: number; lng: number; heading?: number }) => {
      if (user.role !== 'RUNNER' || typeof loc?.lat !== 'number' || typeof loc?.lng !== 'number') return;
      const now = new Date().toISOString();
      await db.update(schema.runnerProfiles).set({ lat: loc.lat, lng: loc.lng, lastSeenAt: now }).where(eq(schema.runnerProfiles.userId, user.id));
      const active = await db
        .select({ id: schema.orders.id, customerId: schema.orders.customerId, shopId: schema.orders.shopId })
        .from(schema.orders)
        .where(and(eq(schema.orders.runnerId, user.id), inArray(schema.orders.status, ACTIVE_ORDER_STATUSES)));
      const payload = { runnerId: user.id, lat: loc.lat, lng: loc.lng, heading: loc.heading ?? null, at: now };
      for (const o of active) {
        io!.to(rooms.order(o.id)).to(rooms.user(o.customerId)).to(rooms.shop(o.shopId)).emit('runner:location', { ...payload, orderId: o.id });
      }
      io!.to(rooms.admins).emit('runner:location', payload);
    });

    socket.on('typing', (orderId: string) => {
      if (typeof orderId === 'string') socket.to(rooms.order(orderId)).emit('typing', { orderId, userId: user.id, name: user.name });
    });
  });

  return io;
}

export function emitToUser(userId: string, event: string, payload: unknown) {
  io?.to(rooms.user(userId)).emit(event, payload);
}
export function emitToShop(shopId: string, event: string, payload: unknown) {
  io?.to(rooms.shop(shopId)).emit(event, payload);
}
export function emitToOrder(orderId: string, event: string, payload: unknown) {
  io?.to(rooms.order(orderId)).emit(event, payload);
}
export function emitToAdmins(event: string, payload: unknown) {
  io?.to(rooms.admins).emit(event, payload);
}
