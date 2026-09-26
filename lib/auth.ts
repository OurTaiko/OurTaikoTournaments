import * as oidc from "openid-client";
import { db, runtime, isDemo } from "./store";
import { RuleError } from "./rules";
import { introspectSession } from "./sso-session";
type AuthSession = {
  kind: "user" | "demo";
  sub: string;
  name: string;
  username: string;
  token?: string;
};
type Attempt = {
  kind: "attempt";
  state: string;
  nonce: string;
  verifier: string;
};
export type Viewer = {
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
export async function viewer(req: Request): Promise<Viewer | null> {
  const s = await readSession(req);
  if (!s || s.kind === "attempt") return null;
  if (s.kind === "demo") {
    return demoAllowed(req)
      ? { name: "本地演示管理员", username: "demo", admin: true, demo: true }
      : null;
  }
  const identity = await introspectSession({ SSO_ISSUER: runtime.SSO_ISSUER, SSO_CLIENT_ID: runtime.SSO_CLIENT_ID, SSO_CLIENT_SECRET: runtime.SSO_CLIENT_SECRET }, { subject: s.sub, token: s.token });
  if (!identity) {
    await removeSession(sessionId(req));
    return null;
  }
  return {
    name: identity.nickname || identity.username,
    username: identity.username,
    admin: identity.isAdmin,
    demo: false,
  };
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
  if (!u.admin) throw new RuleError("当前账号没有 HachiCats 管理权限。", 403);
  return u;
}
export async function login() {
  const c = await config();
  const state = oidc.randomState(),
    nonce = oidc.randomNonce(),
    verifier = oidc.randomPKCECodeVerifier();
  const id = await saveSession(
    { kind: "attempt", state, nonce, verifier },
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
  const lifetime = Math.max(1, Math.min(tokens.expires_in ?? 3600, 3600));
  const id = await saveSession(
    {
      kind: "user",
      sub: claims.sub,
      name: String(info.nickname || username),
      username,
      token: tokens.access_token,
    },
    lifetime,
  );
  return new Response(null, {
    status: 302,
    headers: {
      Location: runtime.APP_ORIGIN + "/?manage=1",
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
      await oidc.tokenRevocation(await config(), s.token);
    } catch {
      /* Local session is already revoked even if SSO is unavailable. */
    }
  return Response.json(
    { ok: true },
    { headers: { "Set-Cookie": cookie("", 0) } },
  );
}
