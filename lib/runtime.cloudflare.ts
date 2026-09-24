import { env } from "cloudflare:workers";
import type { Database, SqlDatabase } from "./database";
import { sqlDatabase } from "./sql-database";
const bindings = env as unknown as Record<string, string> & { DB: SqlDatabase };
export const runtime = new Proxy({} as Record<string, string> & { DB: Database }, {
  get: (_, key) => key === "DB" ? sqlDatabase(bindings.DB) : bindings[String(key)],
});
