import { createClient } from '@libsql/client';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_URL = process.env.DATABASE_URL ?? 'file:./data/juragan.db';

const client = createClient({ url: DB_URL });

async function ensureMigrationsTable() {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at INTEGER NOT NULL
    )
  `);
}

async function getAppliedMigrations(): Promise<Set<string>> {
  const result = await client.execute('SELECT version FROM schema_migrations');
  return new Set(result.rows.map((r) => String(r.version)));
}

async function applyMigration(version: string, sql: string) {
  console.log(`Applying migration ${version}...`);
  await client.execute(sql);
  await client.execute({
    sql: 'INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (?, ?)',
    args: [version, Date.now()],
  });
  console.log(`Migration ${version} applied.`);
}

async function runMigrations() {
  await ensureMigrationsTable();
  const applied = await getAppliedMigrations();

  const migrationsDir = join(__dirname, '..', 'migrations');
  if (!readdirSync(migrationsDir, { withFileTypes: true }).some((d) => d.isDirectory())) {
    // Fallback to api src/migrations
    const apiMigrationsDir = join(__dirname, '..', 'apps', 'api', 'src', 'db', 'migrations');
    await runFromDir(apiMigrationsDir, applied);
    return;
  }

  await runFromDir(migrationsDir, applied);
}

async function runFromDir(dir: string, applied: Set<string>) {
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const version = file.replace(/\.sql$/, '');
    if (applied.has(version)) continue;

    const sql = readFileSync(join(dir, file), 'utf-8');
    try {
      await applyMigration(version, sql);
    } catch (err) {
      console.error(`Migration ${version} failed:`, err);
      process.exit(1);
    }
  }

  console.log('All migrations applied.');
}

runMigrations().catch((err) => {
  console.error(err);
  process.exit(1);
});
