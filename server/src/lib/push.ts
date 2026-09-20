import fs from 'node:fs';
import webpush from 'web-push';
import { eq } from 'drizzle-orm';
import { config } from '../config.js';
import { db, schema } from '../db/index.js';

let keys: { publicKey: string; privateKey: string } | null = null;

/** Load VAPID keys from env, or generate & persist them once (server/.vapid.json). */
export function initPush() {
  if (config.vapidPublicKey && config.vapidPrivateKey) {
    keys = { publicKey: config.vapidPublicKey, privateKey: config.vapidPrivateKey };
  } else if (fs.existsSync(config.vapidFile)) {
    keys = JSON.parse(fs.readFileSync(config.vapidFile, 'utf8'));
  } else {
    keys = webpush.generateVAPIDKeys();
    fs.writeFileSync(config.vapidFile, JSON.stringify(keys, null, 2));
    console.log('[push] generated new VAPID keys →', config.vapidFile);
  }
  webpush.setVapidDetails(config.vapidSubject, keys!.publicKey, keys!.privateKey);
  return keys!;
}

export const getVapidPublicKey = () => keys?.publicKey ?? '';

export async function sendPushToUser(userId: string, payload: { title: string; body: string; url?: string; tag?: string }) {
  if (!keys) return;
  const subs = await db.select().from(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.userId, userId));
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ ...payload, icon: '/icons/icon-192.png', badge: '/icons/badge-72.png' }),
          { TTL: 60 * 60 },
        );
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await db.delete(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.id, s.id));
        }
      }
    }),
  );
}
