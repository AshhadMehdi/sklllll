import { eq } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { DEFAULT_SETTINGS, type PlatformSettings } from './constants.js';

let cache: PlatformSettings | null = null;

export async function getSettings(): Promise<PlatformSettings> {
  if (cache) return cache;
  const rows = await db.select().from(schema.settings);
  const merged: PlatformSettings = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    if (row.key in merged) (merged as Record<string, unknown>)[row.key] = row.value;
  }
  cache = merged;
  return merged;
}

export async function updateSettings(patch: Partial<PlatformSettings>): Promise<PlatformSettings> {
  for (const [key, value] of Object.entries(patch)) {
    if (!(key in DEFAULT_SETTINGS)) continue;
    await db
      .insert(schema.settings)
      .values({ key, value })
      .onConflictDoUpdate({ target: schema.settings.key, set: { value } });
  }
  cache = null;
  return getSettings();
}

export async function getSetting<K extends keyof PlatformSettings>(key: K): Promise<PlatformSettings[K]> {
  return (await getSettings())[key];
}

export const invalidateSettings = () => (cache = null);
export { eq };
