import { db, schema } from '../db/index.js';
import { emitToUser } from '../socket.js';
import { sendPushToUser } from './push.js';

export interface NotifyInput {
  title: string;
  body: string;
  type?: 'order' | 'delivery' | 'promo' | 'system' | 'chat';
  data?: Record<string, unknown>;
  url?: string;
  push?: boolean;
}

/** Persist a notification, push it over the socket and (optionally) as a Web Push. */
export async function notify(userId: string, input: NotifyInput) {
  const [row] = await db
    .insert(schema.notifications)
    .values({ userId, title: input.title, body: input.body, type: input.type ?? 'system', data: { ...(input.data ?? {}), url: input.url } })
    .returning();
  emitToUser(userId, 'notification', row);
  if (input.push !== false) {
    sendPushToUser(userId, { title: input.title, body: input.body, url: input.url, tag: String(input.data?.orderId ?? row.id) }).catch(() => {});
  }
  return row;
}

export async function notifyMany(userIds: string[], input: NotifyInput) {
  await Promise.all([...new Set(userIds)].map((id) => notify(id, input)));
}
