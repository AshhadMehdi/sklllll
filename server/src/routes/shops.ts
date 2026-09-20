import { Router } from 'express';
import { z } from 'zod';
import { and, asc, desc, eq, inArray, like, or, sql } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { parse } from '../middleware/validate.js';
import { notFound } from '../lib/errors.js';
import { boundingBox, estimateEtaMinutes, haversineKm, isWithinHours, resolveZone, round1 } from '../lib/geo.js';
import { SHOP_CATEGORIES } from '../lib/constants.js';
import { getSettings } from '../lib/settings.js';

export const shopsRouter = Router();

const num = (def?: number) => z.coerce.number().optional().default(def as number);

const listSchema = z.object({
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
  radius: num(12),
  category: z.string().optional(),
  q: z.string().trim().max(80).optional(),
  openNow: z.enum(['true', 'false']).optional(),
  sort: z.enum(['distance', 'rating', 'fee', 'eta']).default('distance'),
  limit: num(60),
});

export function decorateShop(shop: schema.Shop, zones: schema.DeliveryZone[], lat?: number, lng?: number) {
  const hours = isWithinHours(shop.hours);
  const isOpenNow = shop.isOpen && hours.open && shop.status === 'APPROVED';
  let distanceKm: number | null = null;
  let zone = null as ReturnType<typeof resolveZone> | null;
  if (lat != null && lng != null) {
    distanceKm = haversineKm(shop.lat, shop.lng, lat, lng);
    zone = resolveZone(zones, distanceKm, 0);
  }
  const maxRadiusKm = zones.length ? Math.max(...zones.map((z) => z.radiusKm)) : 0;
  return {
    ...shop,
    isOpenNow,
    opensAt: hours.opensAt ?? null,
    todayHours: hours.today,
    distanceKm: distanceKm != null ? round1(distanceKm) : null,
    deliverable: zone ? zone.deliverable : true,
    deliveryFee: zone ? zone.fee : zones[0]?.fee ?? 0,
    zoneName: zone?.zone?.name ?? null,
    maxRadiusKm,
    etaMinutes: estimateEtaMinutes(shop.prepTimeMin, distanceKm ?? 2),
    zones: zones.sort((a, b) => a.radiusKm - b.radiusKm),
    categoryLabel: SHOP_CATEGORIES.find((c) => c.id === shop.category)?.label ?? shop.category,
    categoryEmoji: SHOP_CATEGORIES.find((c) => c.id === shop.category)?.emoji ?? '🧺',
  };
}
export type ShopDTO = ReturnType<typeof decorateShop>;

shopsRouter.get('/', async (req, res) => {
  const q = parse(listSchema, req.query);
  const settings = await getSettings();
  const lat = q.lat ?? settings.cityLat;
  const lng = q.lng ?? settings.cityLng;
  const radius = Math.min(q.radius, 50);
  const box = boundingBox(lat, lng, radius);
  const conditions = [
    eq(schema.shops.status, 'APPROVED'),
    sql`${schema.shops.lat} between ${box.minLat} and ${box.maxLat}`,
    sql`${schema.shops.lng} between ${box.minLng} and ${box.maxLng}`,
  ];
  if (q.category && q.category !== 'all') conditions.push(eq(schema.shops.category, q.category));
  let productMatches: Map<string, string[]> | null = null;
  if (q.q) {
    const term = `%${q.q.toLowerCase()}%`;
    const matches = await db
      .select({ shopId: schema.products.shopId, name: schema.products.name })
      .from(schema.products)
      .where(and(eq(schema.products.isAvailable, true), sql`lower(${schema.products.name}) like ${term}`))
      .limit(200);
    productMatches = new Map();
    for (const m of matches) productMatches.set(m.shopId, [...(productMatches.get(m.shopId) ?? []), m.name].slice(0, 4));
    const shopIds = [...productMatches.keys()];
    conditions.push(or(sql`lower(${schema.shops.name}) like ${term}`, sql`lower(${schema.shops.description}) like ${term}`, like(schema.shops.tags, term), shopIds.length ? inArray(schema.shops.id, shopIds) : sql`0`)!);
  }
  const rows = await db.select().from(schema.shops).where(and(...conditions)).limit(300);
  const zones = rows.length ? await db.select().from(schema.deliveryZones).where(inArray(schema.deliveryZones.shopId, rows.map((r) => r.id))) : [];
  const favIds = req.user ? new Set((await db.select({ shopId: schema.favorites.shopId }).from(schema.favorites).where(eq(schema.favorites.userId, req.user.id))).map((f) => f.shopId)) : new Set<string>();

  let list = rows
    .map((s) => ({ ...decorateShop(s, zones.filter((z) => z.shopId === s.id), lat, lng), isFavorite: favIds.has(s.id), matchedProducts: productMatches?.get(s.id) ?? [] }))
    .filter((s) => (s.distanceKm ?? 0) <= radius);
  if (q.openNow === 'true') list = list.filter((s) => s.isOpenNow);
  const sorters: Record<typeof q.sort, (a: (typeof list)[number], b: (typeof list)[number]) => number> = {
    distance: (a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0),
    rating: (a, b) => b.ratingAvg - a.ratingAvg || (a.distanceKm ?? 0) - (b.distanceKm ?? 0),
    fee: (a, b) => a.deliveryFee - b.deliveryFee || (a.distanceKm ?? 0) - (b.distanceKm ?? 0),
    eta: (a, b) => a.etaMinutes - b.etaMinutes,
  };
  list.sort(sorters[q.sort]);
  // open shops first, then closed
  list.sort((a, b) => Number(b.isOpenNow) - Number(a.isOpenNow));
  res.json({ shops: list.slice(0, q.limit), center: { lat, lng }, radiusKm: radius, total: list.length });
});

shopsRouter.get('/categories', async (_req, res) => {
  const counts = await db.select({ category: schema.shops.category, n: sql<number>`count(*)` }).from(schema.shops).where(eq(schema.shops.status, 'APPROVED')).groupBy(schema.shops.category);
  const map = new Map(counts.map((c) => [c.category, Number(c.n)]));
  res.json(SHOP_CATEGORIES.map((c) => ({ ...c, count: map.get(c.id) ?? 0 })));
});

shopsRouter.get('/featured', async (req, res) => {
  const q = parse(z.object({ lat: z.coerce.number().optional(), lng: z.coerce.number().optional() }), req.query);
  const settings = await getSettings();
  const lat = q.lat ?? settings.cityLat;
  const lng = q.lng ?? settings.cityLng;
  const featured = await db
    .select({ product: schema.products, shop: schema.shops })
    .from(schema.products)
    .innerJoin(schema.shops, eq(schema.shops.id, schema.products.shopId))
    .where(and(eq(schema.products.isFeatured, true), eq(schema.products.isAvailable, true), eq(schema.shops.status, 'APPROVED'), sql`${schema.products.stock} > 0`))
    .limit(40);
  const items = featured
    .map((f) => ({ ...f.product, shopName: f.shop.name, shopCategory: f.shop.category, distanceKm: round1(haversineKm(f.shop.lat, f.shop.lng, lat, lng)) }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, 12);
  res.json(items);
});

shopsRouter.get('/:id', async (req, res) => {
  const q = parse(z.object({ lat: z.coerce.number().optional(), lng: z.coerce.number().optional() }), req.query);
  const [shop] = await db.select().from(schema.shops).where(or(eq(schema.shops.id, req.params.id), eq(schema.shops.slug, req.params.id))).limit(1);
  if (!shop) throw notFound('Shop not found');
  const [zones, productRows, reviewRows, fav] = await Promise.all([
    db.select().from(schema.deliveryZones).where(eq(schema.deliveryZones.shopId, shop.id)),
    db.select().from(schema.products).where(eq(schema.products.shopId, shop.id)).orderBy(asc(schema.products.sortOrder), asc(schema.products.name)),
    db
      .select({ review: schema.reviews, customerName: schema.users.name })
      .from(schema.reviews)
      .innerJoin(schema.users, eq(schema.users.id, schema.reviews.customerId))
      .where(eq(schema.reviews.shopId, shop.id))
      .orderBy(desc(schema.reviews.createdAt))
      .limit(20),
    req.user ? db.select().from(schema.favorites).where(and(eq(schema.favorites.userId, req.user.id), eq(schema.favorites.shopId, shop.id))).limit(1) : Promise.resolve([]),
  ]);
  const visibleProducts = productRows.filter((p) => p.isAvailable || req.user?.id === shop.ownerId);
  const categories = [...new Set(visibleProducts.map((p) => p.category))];
  res.json({
    ...decorateShop(shop, zones, q.lat, q.lng),
    isFavorite: fav.length > 0,
    products: visibleProducts,
    categories,
    reviews: reviewRows.map((r) => ({ ...r.review, customerName: r.customerName })),
  });
});
