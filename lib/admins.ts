import type { Database } from "./database";

type AdminConfig = { [key: string]: unknown; ADMIN_USERNAMES?: string; ADMIN_USERNAME?: string };
export function adminUsernames(config: AdminConfig): string[] {
  // Preserve the legacy setting; an explicitly empty list disables all admins.
  return [...new Set((config.ADMIN_USERNAMES ?? config.ADMIN_USERNAME ?? "kirisamevanilla")
    .split(",").map((name) => name.trim()).filter(Boolean))];
}

// Call only after the provider has verified the identity, never with form input.
export async function resolveAdmin(
  database: Database,
  config: AdminConfig,
  identity: { username: string; subject: string; issuer: string },
): Promise<boolean> {
  const names = adminUsernames(config);
  if (!names.length || !identity.subject || !identity.issuer) return false;
  if (names.includes(identity.username)) {
    await database.prepare(
      "INSERT OR IGNORE INTO admins (username, subject, issuer) VALUES (?, ?, ?)",
    ).bind(identity.username, identity.subject, identity.issuer).run();
  }
  // Existing bindings cannot be reassigned by a renamed/recreated SSO account.
  const bound = await database.prepare(
    `SELECT subject FROM admins WHERE username IN (${names.map(() => "?").join(",")}) AND issuer = ? AND subject = ?`,
  ).bind(...names, identity.issuer, identity.subject).first();
  return !!bound;
}
