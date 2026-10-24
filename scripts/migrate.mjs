import { Pool } from 'pg';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export async function migrate() {
  if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL in Render Environment first');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 15000 });
  const client = await pool.connect().catch(async () => {
    await pool.end();
    throw new Error('Cannot connect to database; check DATABASE_URL and database availability');
  });
  try {
    await client.query('BEGIN');
    // Transaction lock works with the Neon transaction pooler too.
    await client.query('SELECT pg_advisory_xact_lock(17824053)');
    await client.query('CREATE TABLE IF NOT EXISTS app_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
    const folder = new URL('../migrations/', import.meta.url);
    for (const name of (await readdir(folder)).filter(n => n.endsWith('.sql')).sort()) {
      const sql = await readFile(new URL(name, folder), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const { rows } = await client.query('SELECT checksum FROM app_migrations WHERE name=$1', [name]);
      if (rows.length) {
        if (rows[0].checksum !== checksum) throw new Error(`Previously applied migration changed: ${name}`);
        continue;
      }
      await client.query(sql);
      await client.query('INSERT INTO app_migrations(name,checksum) VALUES($1,$2)', [name,checksum]);
      console.log(`Applied ${name}`);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    // Do not log SQL or connection strings that may contain private data.
    console.error('Database migration failed; no new migration was committed.');
    throw new Error(error instanceof Error && error.message.startsWith('Previously applied') ? error.message : 'Database migration failed');
  } finally { client.release(); await pool.end(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  migrate().catch(error => { console.error(error.message); process.exitCode = 1; });
}
