import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { type Client, createClient } from '@libsql/client';

export type Db = Client;

// Must point at the same LibSQL file the API writes to. Default matches apps/api.
export const DATABASE_URL = process.env.DATABASE_URL ?? 'file:./data/juragan.db';

function ensureFsPath(url: string) {
  if (!url.startsWith('file:')) return;
  const path = url.slice('file:'.length);
  if (path === ':memory:') return;
  mkdirSync(dirname(path), { recursive: true });
}

let _db: Db | null = null;

export function getDb(): Db {
  if (_db) return _db;
  ensureFsPath(DATABASE_URL);
  _db = createClient({ url: DATABASE_URL });
  return _db;
}
