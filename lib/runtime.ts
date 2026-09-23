import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { Database, PreparedQuery } from "./database";

let connection: DatabaseSync | undefined;
function sqlite() {
  if (connection) return connection;
  const path = resolve(process.env.DATABASE_PATH || ".data/hachicats.sqlite");
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const next = new DatabaseSync(path);
  next.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS admins (username TEXT PRIMARY KEY NOT NULL, subject TEXT NOT NULL, issuer TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY NOT NULL, body TEXT NOT NULL, expires INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS sessions_expires ON sessions(expires);
    CREATE TABLE IF NOT EXISTS tournaments (id TEXT PRIMARY KEY NOT NULL, revision INTEGER NOT NULL, body TEXT NOT NULL);`);
  next.prepare("DELETE FROM sessions WHERE expires <= ?").run(Date.now());
  connection = next;
  return next;
}
function query(sql: string, values: (string | number | null)[] = []): PreparedQuery {
  return {
    bind: (...args) => query(sql, args),
    async first<T>() { return (sqlite().prepare(sql).get(...values) as T | undefined) ?? null; },
    async run() { return { meta: { changes: Number(sqlite().prepare(sql).run(...values).changes) } }; },
  };
}
const database: Database = { prepare: (sql) => query(sql) };
export const runtime = new Proxy({} as Record<string, string> & { DB: Database }, {
  get: (_, key) => key === "DB" ? database : process.env[String(key)],
});
