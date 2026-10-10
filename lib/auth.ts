import { safeReturnTo } from "./auth-navigation";
import * as oidc from "openid-client";
import { db, runtime, isDemo } from "./store";
import { RuleError } from "./rules";
import { introspectSession, revokeSession } from "./sso-session";
import { openRefreshToken, sealRefreshToken } from "./session-crypto";
import type { SessionRow } from "./database";
export const loginLifetime = 7 * 86400;
const refreshWindow = 60_000;
const refreshLeaseDuration = 60_000;
const unavailable = () => new RuleError("暂时无法验证登录状态，已保留登录，请稍后重试。", 503);
type AuthSession = {
  kind: "user" | "demo";
  sub: string;
  name: string;
  username: string;
  token?: string;
  refreshToken?: string;
  accessExpiresAt?: number;
  refreshLease?: { owner: string; until: number };
};
type Attempt = {
  kind: "attempt";
  state: string;
  nonce: string;
  verifier: string;
  returnTo?: string;
};
export type Viewer = {
  id: string;
  name: string;
  username: string;
  admin: boolean;
  demo: boolean;
};
const cookieName = "hachicats_session";
export function cookie(id: string, maxAge = 3600) {
  return `${cookieName}=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${runtime.APP_ORIGIN?.startsWith("https:") ? "; Secure" : ""}`;
}
export function sessionId(req: Request) {
  return (
    req.headers
      .get("cookie")
      ?.split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith(cookieName + "="))
      ?.slice(cookieName.length + 1) || ""
  );
}
export async function saveSession(body: AuthSession | Attempt, seconds = 3600) {
  const id = oidc.randomState();
  await db().saveSession({ id, body: JSON.stringify(body), expires: Date.now() + seconds * 1000 });
  return id;
}
export async function removeSession(id: string) {
  await db().deleteSession(id);
}
async function readSession(req: Request) {
  const row = await db().getSession(sessionId(req), Date.now());
  return row ? (JSON.parse(row.body) as AuthSession | Attempt) : null;
}
export async function loginReturnTo(req: Request) {
  const session = await readSession(req);
  return safeReturnTo(session?.kind === "attempt" ? session.returnTo : "/");
}
export async function config() {
  if (!runtime.SSO_CLIENT_SECRET)
    throw new RuleError(
      "OurTaiko SSO 登录暂未配置完成，请联系主办方。",
      503,
    );
  const issuer = new URL(runtime.SSO_ISSUER);
  const local =
    issuer.protocol === "http:" &&
    ["127.0.0.1", "localhost"].includes(issuer.hostname);
  if (issuer.protocol !== "https:" && !local)
    throw new RuleError("SSO 地址必须使用 HTTPS。", 503);
  return oidc.discovery(
    issuer,
    runtime.SSO_CLIENT_ID,
    {
      client_secret: runtime.SSO_CLIENT_SECRET,
      id_token_signed_response_alg: "RS256",
    },
    oidc.ClientSecretBasic(runtime.SSO_CLIENT_SECRET),
    {
      timeout: 8,
      execute: [
        ...(local ? [oidc.allowInsecureRequests] : []),
        oidc.enableNonRepudiationChecks,
      ],
    },
  );
}
async function revokeTokens(session: AuthSession) {
  await revokeSession({ SSO_ISSUER: runtime.SSO_ISSUER, SSO_CLIENT_ID: runtime.SSO_CLIENT_ID, SSO_CLIENT_SECRET: runtime.SSO_CLIENT_SECRET }, {
    accessToken: session.token,
    refreshToken: session.refreshToken
      ? openRefreshToken(session.refreshToken, runtime.SSO_CLIENT_SECRET, session.sub) : undefined,
  });
}

async function renewSession(row: SessionRow): Promise<SessionRow | null> {
  const deadline = Date.now() + 10_000;
  for (;;) {
    const session = JSON.parse(row.body) as AuthSession;
    if (session.kind !== "user" || !session.refreshToken ||
        (session.accessExpiresAt ?? 0) > Date.now() + refreshWindow) return row;
    if (session.refreshLease && session.refreshLease.until > Date.now()) {
      if (Date.now() >= deadline) throw unavailable();
      await new Promise(resolve => setTimeout(resolve, 100));
      const latest = await db().getSession(row.id, Date.now());
      if (!latest) return null;
      row = latest;
      continue;
    }
    // CAS in the shared database serializes refreshes across Vercel instances.
    const locked = JSON.stringify({ ...session, refreshLease: {
      owner: oidc.randomState(), until: Date.now() + refreshLeaseDuration,
    } });
    if (!await db().updateSession(row.id, row.body, locked, Date.now())) {
      const latest = await db().getSession(row.id, Date.now());
      if (!latest) return null;
      row = latest;
      if (Date.now() >= deadline) throw unavailable();
      continue;
    }
    let renewed: AuthSession | undefined;
    try {
      const tokens = await oidc.refreshTokenGrant(await config(),
        openRefreshToken(session.refreshToken, runtime.SSO_CLIENT_SECRET, session.sub));
      if (!tokens.access_token || !Number.isFinite(tokens.expires_in) || tokens.expires_in! <= 0 ||
          (tokens.claims()?.sub && tokens.claims()!.sub !== session.sub)) throw unavailable();
      renewed = { ...session, token: tokens.access_token,
        refreshToken: tokens.refresh_token
          ? sealRefreshToken(tokens.refresh_token, runtime.SSO_CLIENT_SECRET, session.sub)
          : session.refreshToken,
        accessExpiresAt: Date.now() + tokens.expires_in! * 1000 };
      delete renewed.refreshLease;
      const body = JSON.stringify(renewed);
      if (!await db().updateSession(row.id, locked, body, Date.now())) {
        // Logout/expiry must never be undone by a refresh that was already in flight.
        await revokeTokens(renewed).catch(() => {});
        return null;
      }
      return { ...row, body };
    } catch (error) {
      if (error instanceof oidc.ResponseBodyError && error.error === "invalid_grant") {
        await db().deleteSession(row.id, locked);
        return null;
      }
      // If persistence failed after rotation, do not discard the new credentials.
      if (renewed) {
        try {
          if (await db().updateSession(row.id, locked, JSON.stringify(renewed), Date.now()))
            return { ...row, body: JSON.stringify(renewed) };
        } catch { /* Keep the lease until it expires; never expose upstream errors. */ }
      } else {
        await db().updateSession(row.id, locked, row.body, Date.now()).catch(() => {});
      }
      throw unavailable();
    }
  }
}

export async function viewer(req: Request): Promise<Viewer | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const saved = await db().getSession(sessionId(req), Date.now());
    const row = saved && await renewSession(saved);
    if (!row) return null;
    const s = JSON.parse(row.body) as AuthSession | Attempt;
    if (s.kind === "attempt") return null;
    if (s.kind === "demo") {
      return demoAllowed(req)
        ? { id: "local-demo", name: "本地演示管理员", username: "demo", admin: true, demo: true }
        : null;
    }
    const identity = await introspectSession({ SSO_ISSUER: runtime.SSO_ISSUER, SSO_CLIENT_ID: runtime.SSO_CLIENT_ID, SSO_CLIENT_SECRET: runtime.SSO_CLIENT_SECRET }, { subject: s.sub, token: s.token });
    if (!identity) {
      // An old in-flight check must not delete a concurrently refreshed session.
      if (await db().deleteSession(row.id, row.body)) return null;
      continue;
    }
    // Recheck local logout and absolute expiry after the upstream round trip.
    if (!await db().getSession(row.id, Date.now())) return null;
    return { id: identity.id, name: identity.nickname || identity.username,
      username: identity.username, admin: identity.isAdmin, demo: false };
  }
  throw unavailable();
}
export function demoAllowed(req: Request) {
  return (
    isDemo() &&
    ["127.0.0.1", "localhost", "[::1]"].includes(new URL(req.url).hostname) &&
    ["127.0.0.1", "localhost"].includes(new URL(runtime.APP_ORIGIN).hostname)
  );
}
export async function requireAdmin(req: Request) {
  const u = await viewer(req);
  if (!u) throw new RuleError("请先登录。", 401);
  if (!u.admin) throw new RuleError("当前账号没有赛事管理权限。", 403);
  return u;
}
export async function login(returnTo?: string) {
  const c = await config();
  const state = oidc.randomState(),
    nonce = oidc.randomNonce(),
    verifier = oidc.randomPKCECodeVerifier();
  const id = await saveSession(
    { kind: "attempt", state, nonce, verifier, returnTo: safeReturnTo(returnTo) },
    600,
  );
  const url = oidc.buildAuthorizationUrl(c, {
    redirect_uri: runtime.APP_ORIGIN + "/api/auth/callback",
    scope: "openid profile",
    state,
    nonce,
    code_challenge: await oidc.calculatePKCECodeChallenge(verifier),
    code_challenge_method: "S256",
  });
  return new Response(null, {
    status: 302,
    headers: {
      Location: url.toString(),
      "Set-Cookie": cookie(id, 600),
      "Cache-Control": "no-store",
    },
  });
}
export async function callback(req: Request) {
  const attempt = await readSession(req);
  if (!attempt || attempt.kind !== "attempt")
    throw new RuleError("登录请求已失效，请重新登录。");
  const consumed = await db().deleteSession(sessionId(req));
  if (!consumed) throw new RuleError("此登录回调已使用。");
  const c = await config();
  // Reconstruct the public callback behind the trusted reverse proxy.
  const callbackUrl = new URL("/api/auth/callback", runtime.APP_ORIGIN);
  callbackUrl.search = new URL(req.url).search;
  const tokens = await oidc.authorizationCodeGrant(c, callbackUrl, {
    pkceCodeVerifier: attempt.verifier,
    expectedState: attempt.state,
    expectedNonce: attempt.nonce,
    idTokenExpected: true,
  });
  const claims = tokens.claims();
  if (!claims?.sub) throw new RuleError("登录身份无效。");
  const info = await oidc.fetchUserInfo(c, tokens.access_token, claims.sub);
  const username = String(info.preferred_username || "");
  if (!tokens.refresh_token || !Number.isFinite(tokens.expires_in) || tokens.expires_in! <= 0)
    throw new RuleError("登录服务未提供续期凭据，请稍后重试。", 503);
  const lifetime = loginLifetime;
  const id = await saveSession(
    {
      kind: "user",
      sub: claims.sub,
      name: String(info.nickname || username),
      username,
      token: tokens.access_token,
      refreshToken: sealRefreshToken(tokens.refresh_token, runtime.SSO_CLIENT_SECRET, claims.sub),
      accessExpiresAt: Date.now() + tokens.expires_in! * 1000,
    },
    lifetime,
  );
  return new Response(null, {
    status: 302,
    headers: {
      Location: runtime.APP_ORIGIN + safeReturnTo(attempt.returnTo),
      "Set-Cookie": cookie(id, lifetime),
      "Cache-Control": "no-store",
    },
  });
}
export async function logout(req: Request) {
  const s = await readSession(req);
  await removeSession(sessionId(req));
  if (s?.kind === "user" && s.token)
    try {
      await revokeTokens(s);
    } catch {
      /* Local session is already revoked even if SSO is unavailable. */
    }
  return Response.json(
    { ok: true },
    { headers: { "Set-Cookie": cookie("", 0) } },
  );
}
