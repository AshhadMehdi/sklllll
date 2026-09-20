import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
// src/  (dev via tsx)  or  dist/ (compiled) → both are one level under the server root
export const serverRoot = path.resolve(here, '..');
export const repoRoot = path.resolve(serverRoot, '..');

const env = (key: string, fallback = '') => process.env[key] ?? fallback;

export const config = {
  nodeEnv: env('NODE_ENV', 'development'),
  isProd: env('NODE_ENV', 'development') === 'production',
  port: Number(env('PORT', '4000')),
  appName: env('APP_NAME', 'Qareeb'),
  jwtSecret: env('JWT_SECRET', 'qareeb-dev-secret-change-me-in-production'),
  jwtExpiresIn: env('JWT_EXPIRES_IN', '30d'),
  dbUrl: env('DATABASE_URL', `file:${path.join(serverRoot, 'data', 'qareeb.db')}`),
  dbAuthToken: env('DATABASE_AUTH_TOKEN', ''),
  migrationsDir: path.join(serverRoot, 'drizzle'),
  uploadsDir: env('UPLOADS_DIR', path.join(serverRoot, 'uploads')),
  clientDist: path.join(repoRoot, 'client', 'dist'),
  // Public origin of this API (only needed when the frontend is hosted on another domain) – makes upload URLs absolute
  publicUrl: env('PUBLIC_URL', '').replace(/\/+$/, ''),
  corsOrigins: env('CORS_ORIGINS', '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  googleClientId: env('GOOGLE_CLIENT_ID', ''),
  vapidSubject: env('VAPID_SUBJECT', 'mailto:support@qareeb.app'),
  vapidPublicKey: env('VAPID_PUBLIC_KEY', ''),
  vapidPrivateKey: env('VAPID_PRIVATE_KEY', ''),
  vapidFile: path.join(serverRoot, '.vapid.json'),
  autoSeed: env('AUTO_SEED', 'true') !== 'false',
  demoPassword: env('DEMO_PASSWORD', 'password123'),
  // Sensible default city (used for demo data and as a fallback location)
  defaultCity: { name: 'Abbottabad', lat: 34.1688, lng: 73.2215 },
};

export type AppConfig = typeof config;
