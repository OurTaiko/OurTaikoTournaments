import { RuleError } from "./rules";

type SsoConfig = { SSO_ISSUER?: string; SSO_CLIENT_ID?: string; SSO_CLIENT_SECRET?: string };
export type SsoIdentity = { id: string; username: string; nickname: string; isAdmin: boolean };

// Only called by server-side session verification. Never cache application roles.
export async function introspectSession(
  config: SsoConfig,
  session: { subject: string; token?: string },
): Promise<SsoIdentity | null> {
  if (!session.token || !session.subject) return null;
  const unavailable = () => new RuleError("暂时无法向 OurTaiko 验证登录权限，请稍后重试。", 503);
  try {
    if (!config.SSO_CLIENT_ID || !config.SSO_CLIENT_SECRET || !config.SSO_ISSUER) throw unavailable();
    const issuer = new URL(config.SSO_ISSUER);
    const local = issuer.protocol === "http:" && ["localhost", "127.0.0.1"].includes(issuer.hostname);
    if ((issuer.protocol !== "https:" && !local) || issuer.username || issuer.password || issuer.search || issuer.hash)
      throw unavailable();
    const response = await fetch(new URL("/internal/v1/web/introspect", issuer), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Service-ID": config.SSO_CLIENT_ID,
        "X-Service-Key": config.SSO_CLIENT_SECRET,
      },
      body: JSON.stringify({ accessToken: session.token }),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(8000),
    });
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object") throw unavailable();
    const body = payload as { code?: unknown; user?: unknown; expiresAt?: unknown };
    // A bad application secret is an upstream configuration failure, not a logout.
    if (response.status === 401 && body?.code === "UNAUTHORIZED") return null;
    if (!response.ok) throw unavailable();
    if (!body.user || typeof body.user !== "object") throw unavailable();
    const user = body.user as { id?: unknown; username?: unknown; nickname?: unknown; isAdmin?: unknown };
    if (
      !user || user.id !== session.subject ||
      typeof user.username !== "string" || !user.username ||
      typeof user.nickname !== "string" || typeof user.isAdmin !== "boolean" ||
      typeof body.expiresAt !== "string" || !Number.isFinite(Date.parse(body.expiresAt))
    ) throw unavailable();
    if (Date.parse(body.expiresAt) <= Date.now()) return null;
    return { id: session.subject, username: user.username, nickname: user.nickname, isAdmin: user.isAdmin };
  } catch {
    // Never expose upstream response bodies, tokens or configuration values.
    throw unavailable();
  }
}
