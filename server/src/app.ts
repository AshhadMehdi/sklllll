import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { optionalAuth } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { authRouter } from './routes/auth.js';
import { usersRouter } from './routes/users.js';
import { shopsRouter } from './routes/shops.js';
import { ordersRouter } from './routes/orders.js';
import { merchantRouter } from './routes/merchant.js';
import { runnerRouter } from './routes/runner.js';
import { adminRouter } from './routes/admin.js';
import { uploadsRouter } from './routes/uploads.js';
import { metaRouter } from './routes/meta.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' }, crossOriginEmbedderPolicy: false }));
  app.use(cors({ origin: config.corsOrigins.length ? config.corsOrigins : true, credentials: true }));
  app.use(compression());
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));
  if (!config.isProd) app.use(morgan('dev', { skip: (req) => req.path.startsWith('/uploads') }));

  app.use('/uploads', express.static(config.uploadsDir, { maxAge: '7d', immutable: true }));

  const api = express.Router();
  api.use(optionalAuth);
  api.use('/', metaRouter);
  api.use('/auth', authRouter);
  api.use('/users', usersRouter);
  api.use('/shops', shopsRouter);
  api.use('/orders', ordersRouter);
  api.use('/merchant', merchantRouter);
  api.use('/runner', runnerRouter);
  api.use('/admin', adminRouter);
  api.use('/uploads', uploadsRouter);
  api.use(notFoundHandler);
  app.use('/api', api);

  // Production: serve the compiled client (SPA fallback)
  if (fs.existsSync(config.clientDist)) {
    app.use(express.static(config.clientDist, { maxAge: '1h', index: false }));
    app.get(/^(?!\/api|\/socket\.io|\/uploads).*/, (_req, res) => res.sendFile(path.join(config.clientDist, 'index.html')));
  } else {
    app.get('/', (_req, res) => res.json({ ok: true, message: `${config.appName} API — client dev server runs separately (npm run dev)` }));
  }

  app.use(errorHandler);
  return app;
}
