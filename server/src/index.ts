import http from 'node:http';
import { config } from './config.js';
import { createApp } from './app.js';
import { runMigrations, db, schema } from './db/index.js';
import { initSocket } from './socket.js';
import { initPush } from './lib/push.js';
import { seedIfEmpty } from './db/seed.js';

async function main() {
  await runMigrations();
  if (config.autoSeed) await seedIfEmpty();
  initPush();

  const app = createApp();
  const server = http.createServer(app);
  initSocket(server, config.corsOrigins.length ? config.corsOrigins : true);

  server.listen(config.port, '0.0.0.0', () => {
    console.log(`\n🛵  ${config.appName} API ready on http://0.0.0.0:${config.port}  (${config.nodeEnv})`);
    console.log(`    DB: ${config.dbUrl}`);
  });

  const shutdown = () => {
    console.log('\n[api] shutting down…');
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[api] fatal', err);
  process.exit(1);
});

void db;
void schema;
