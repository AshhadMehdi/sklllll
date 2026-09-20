import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import rateLimit from 'express-rate-limit';
import { OAuth2Client } from 'google-auth-library';
import { db, schema } from '../db/index.js';
import { config } from '../config.js';
import { parse } from '../middleware/validate.js';
import { requireAuth, signToken, toAuthUser } from '../middleware/auth.js';
import { badRequest, conflict, unauthorized } from '../lib/errors.js';
import { ROLES } from '../lib/constants.js';

export const authRouter = Router();

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: 'draft-7', legacyHeaders: false });
authRouter.use(limiter);

const emailSchema = z.string().trim().toLowerCase().email('Enter a valid email address');
const passwordSchema = z.string().min(6, 'Password must be at least 6 characters').max(100);
const phoneSchema = z
  .string()
  .trim()
  .regex(/^[+0-9 ()-]{7,20}$/, 'Enter a valid phone number')
  .optional()
  .or(z.literal(''));

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Tell us your name').max(80),
  email: emailSchema,
  password: passwordSchema,
  phone: phoneSchema,
  role: z.enum(['CUSTOMER', 'MERCHANT', 'RUNNER']).default('CUSTOMER'),
  vehicleType: z.enum(['bike', 'scooter', 'car', 'bicycle', 'walk']).optional(),
});

async function issueSession(user: schema.User) {
  const token = signToken(user.id);
  return { token, user: toAuthUser(user) };
}

authRouter.post('/register', async (req, res) => {
  const body = parse(registerSchema, req.body);
  const [existing] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, body.email)).limit(1);
  if (existing) throw conflict('An account with this email already exists. Try signing in.');
  const passwordHash = await bcrypt.hash(body.password, 10);
  const [user] = await db
    .insert(schema.users)
    .values({ name: body.name, email: body.email, passwordHash, phone: body.phone || null, role: body.role })
    .returning();
  if (body.role === 'RUNNER') {
    await db.insert(schema.runnerProfiles).values({ userId: user.id, vehicleType: body.vehicleType ?? 'bike', isAvailable: false });
  }
  res.status(201).json(await issueSession(user));
});

authRouter.post('/login', async (req, res) => {
  const body = parse(z.object({ email: emailSchema, password: z.string().min(1, 'Enter your password') }), req.body);
  const [user] = await db.select().from(schema.users).where(eq(schema.users.email, body.email)).limit(1);
  if (!user || !user.passwordHash) throw unauthorized('Incorrect email or password');
  const ok = await bcrypt.compare(body.password, user.passwordHash);
  if (!ok) throw unauthorized('Incorrect email or password');
  if (!user.isActive) throw unauthorized('This account has been deactivated. Contact support.');
  res.json(await issueSession(user));
});

/** Google Sign-In: the client sends the ID token from Google Identity Services. */
authRouter.post('/google', async (req, res) => {
  const body = parse(z.object({ credential: z.string().min(10), role: z.enum(['CUSTOMER', 'MERCHANT', 'RUNNER']).optional() }), req.body);
  if (!config.googleClientId) throw badRequest('Google Sign-In is not configured on this server (set GOOGLE_CLIENT_ID)');
  const client = new OAuth2Client(config.googleClientId);
  const ticket = await client.verifyIdToken({ idToken: body.credential, audience: config.googleClientId });
  const payload = ticket.getPayload();
  if (!payload?.email) throw unauthorized('Google did not return an email address');
  const email = payload.email.toLowerCase();
  let [user] = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
  if (!user) {
    [user] = await db
      .insert(schema.users)
      .values({ name: payload.name ?? email.split('@')[0], email, googleId: payload.sub, avatarUrl: payload.picture ?? null, role: body.role ?? 'CUSTOMER' })
      .returning();
    if (user.role === 'RUNNER') await db.insert(schema.runnerProfiles).values({ userId: user.id });
  } else if (!user.googleId) {
    [user] = await db.update(schema.users).set({ googleId: payload.sub, avatarUrl: user.avatarUrl ?? payload.picture ?? null }).where(eq(schema.users.id, user.id)).returning();
  }
  if (!user.isActive) throw unauthorized('This account has been deactivated. Contact support.');
  res.json(await issueSession(user));
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, req.user!.id)).limit(1);
  const extra: Record<string, unknown> = {};
  if (user.role === 'MERCHANT') {
    const [shop] = await db.select({ id: schema.shops.id, name: schema.shops.name, status: schema.shops.status }).from(schema.shops).where(eq(schema.shops.ownerId, user.id)).limit(1);
    extra.shop = shop ?? null;
  }
  if (user.role === 'RUNNER') {
    const [profile] = await db.select().from(schema.runnerProfiles).where(eq(schema.runnerProfiles.userId, user.id)).limit(1);
    extra.runnerProfile = profile ?? null;
  }
  res.json({ user: toAuthUser(user), ...extra });
});

authRouter.post('/change-password', requireAuth, async (req, res) => {
  const body = parse(z.object({ currentPassword: z.string().optional(), newPassword: passwordSchema }), req.body);
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, req.user!.id)).limit(1);
  if (user.passwordHash) {
    if (!body.currentPassword || !(await bcrypt.compare(body.currentPassword, user.passwordHash))) throw unauthorized('Current password is incorrect');
  }
  await db.update(schema.users).set({ passwordHash: await bcrypt.hash(body.newPassword, 10) }).where(eq(schema.users.id, user.id));
  res.json({ ok: true });
});

authRouter.get('/config', (_req, res) => {
  res.json({ googleClientId: config.googleClientId || null, appName: config.appName, roles: ROLES, demoPassword: config.isProd ? null : config.demoPassword });
});
