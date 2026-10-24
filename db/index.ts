import { Pool, type QueryResultRow } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

const state = globalThis as typeof globalThis & { waitupfatPool?: Pool };

export function getPool() {
  if (!state.waitupfatPool) {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
    state.waitupfatPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: Math.max(1, Math.min(5, Number(process.env.PG_POOL_MAX) || 5)),
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 15_000,
      query_timeout: 20_000,
    });
    state.waitupfatPool.on("error", () => console.error("database_idle_connection_error"));
  }
  return state.waitupfatPool;
}

export function getDb() {
  return drizzle(getPool(), { schema });
}

export async function query<T extends QueryResultRow = QueryResultRow>(sql: string, values: unknown[] = []) {
  return (await getPool().query<T>(sql, values)).rows;
}

export async function first<T extends QueryResultRow = QueryResultRow>(sql: string, values: unknown[] = []) {
  return (await query<T>(sql, values))[0] ?? null;
}
