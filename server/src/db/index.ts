import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import * as schema from './schema.js';
import { config } from '../config.js';

// Make sure the local SQLite directory exists when using a file: URL
if (config.dbUrl.startsWith('file:')) {
  const filePath = config.dbUrl.replace(/^file:/, '');
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

export const client = createClient({ url: config.dbUrl, authToken: config.dbAuthToken || undefined });
export const db = drizzle(client, { schema });
export { schema };

export async function runMigrations() {
  await client.execute('PRAGMA foreign_keys = ON;');
  await migrate(db, { migrationsFolder: config.migrationsDir });
}
