import { env } from "cloudflare:workers";
import type { Database } from "./database";
export const runtime = env as unknown as Record<string, string> & { DB: Database };
