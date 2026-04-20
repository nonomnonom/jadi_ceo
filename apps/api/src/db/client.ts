import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { type Client, createClient } from '@libsql/client';

export type Db = Client;

export const DATABASE_URL = process.env.DATABASE_URL ?? 'file:./data/juragan.db';

export function createDb(url: string): Db {
  if (url.startsWith('file:')) {
    const path = url.slice('file:'.length);
    if (path !== ':memory:') {
      mkdirSync(dirname(path), { recursive: true });
    }
  }
  return createClient({ url });
}

let _db: Db | null = null;

/** Lazy accessor for the process-wide LibSQL client. Tests use `createDb(':memory:')` directly. */
export function getDb(): Db {
  if (!_db) _db = createDb(DATABASE_URL);
  return _db;
}
