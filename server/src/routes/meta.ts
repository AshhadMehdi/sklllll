import { Router } from 'express';
import { config } from '../config.js';
import { PAYMENT_METHODS, PRODUCT_UNITS, SHOP_CATEGORIES } from '../lib/constants.js';
import { getSettings } from '../lib/settings.js';
import { getVapidPublicKey } from '../lib/push.js';

export const metaRouter = Router();

metaRouter.get('/health', (_req, res) => res.json({ ok: true, name: config.appName, time: new Date().toISOString() }));

/** Public app configuration consumed by the client at boot. */
metaRouter.get('/config', async (_req, res) => {
  const s = await getSettings();
  res.json({
    appName: config.appName,
    currency: s.currency,
    city: { name: s.cityName, lat: s.cityLat, lng: s.cityLng },
    serviceFee: s.serviceFee,
    pointsRatePct: s.pointsRatePct,
    customerCancelWindowMin: s.customerCancelWindowMin,
    categories: SHOP_CATEGORIES,
    units: PRODUCT_UNITS,
    paymentMethods: PAYMENT_METHODS,
    googleClientId: config.googleClientId || null,
    vapidPublicKey: getVapidPublicKey(),
    demo: config.isProd ? null : { password: config.demoPassword },
  });
});
