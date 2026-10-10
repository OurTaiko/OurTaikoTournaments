import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
const dir = await mkdtemp(tmpdir() + '/ott-renewal-');
Object.assign(process.env, { DATABASE_PATH: dir + '/test.sqlite', MONGODB_URI: '', VERCEL: '',
  DEMO_MODE: 'false', APP_ORIGIN: 'https://cats.example', SSO_ISSUER: 'https://sso.example',
  SSO_CLIENT_ID: 'cats', SSO_CLIENT_SECRET: 'test-secret' });
const originalFetch = globalThis.fetch, originalNow = Date.now;
let now = originalNow(), sequence = 0, refreshes = 0, admin = true, revoked = false;
Date.now = () => now;
const revokedTokens = [];
const tokens = () => ({ access_token: 'access-' + sequence, refresh_token: 'refresh-' + sequence,
  expires_in: 3600, claims: () => ({ sub: 'user-1' }) });
let refresh = async () => { sequence++; return tokens(); };
globalThis.oidcFixture = {
  randomState: () => 'session-' + (++sequence),
  discovery: async () => ({}), ClientSecretBasic: () => ({}),
  authorizationCodeGrant: async () => tokens(), fetchUserInfo: async () => ({ preferred_username: 'user' }),
  refreshTokenGrant: async (...args) => { refreshes++; return refresh(...args); },
  tokenRevocation: async (_config, token) => { revokedTokens.push(token); },
};
try {
  await build({ stdin: { contents: `export * from './lib/auth'; export * from './lib/session-crypto'; export {runtime} from './lib/runtime';`, resolveDir: process.cwd() },
    bundle: true, platform: 'node', format: 'cjs', outfile: dir + '/test.cjs', plugins: [{ name: 'oidc-fixture', setup(b) {
      b.onResolve({ filter: /^openid-client$/ }, () => ({ path: 'fixture', namespace: 'oidc-fixture' }));
      b.onLoad({ filter: /.*/, namespace: 'oidc-fixture' }, () => ({ contents: `
        export const {randomState,discovery,ClientSecretBasic,authorizationCodeGrant,fetchUserInfo,refreshTokenGrant,tokenRevocation} = globalThis.oidcFixture;
        export class ResponseBodyError extends Error { constructor(error) { super(error); this.error = error; } }
        globalThis.InvalidGrant = ResponseBodyError;
        export const enableNonRepudiationChecks = () => {};
        export const allowInsecureRequests = () => {};
        export const randomNonce = randomState, randomPKCECodeVerifier = randomState;
        export const calculatePKCECodeChallenge = async v => v;
        export const buildAuthorizationUrl = () => new URL('https://sso.example/authorize');
      ` }));
    } }] });
  const api = (await import(pathToFileURL(dir + '/test.cjs'))).default;
  const db = api.runtime.DB;
  globalThis.fetch = async (_url, init) => {
    if (String(_url).endsWith('/web/revoke')) {
      const body = JSON.parse(init.body); revokedTokens.push(body.refreshToken, body.accessToken);
      assert.equal(init.headers['X-Service-ID'], 'cats');
      return Response.json({ok:true});
    }
    return revoked
    ? Response.json({code: 'UNAUTHORIZED'}, {status: 401})
    : Response.json({ user: { id: 'user-1', username: 'user', nickname: 'User', isAdmin: admin },
      expiresAt: new Date(now + 3600000).toISOString(), tokenReceived: JSON.parse(init.body).accessToken });
  };
  const request = id => new Request('https://cats.example/api/session', { headers: {Cookie: 'hachicats_session=' + id} });
  const freshLogin = async () => {
    const attempt = await api.saveSession({kind:'attempt', state:'test', nonce:'test', verifier:'test', returnTo:'/'});
    const response = await api.callback(request(attempt));
    assert.match(response.headers.get('Set-Cookie'), /Max-Age=604800/);
    assert.match(response.headers.get('Set-Cookie'), /HttpOnly; SameSite=Lax/);
    const id = response.headers.get('Set-Cookie').split(';')[0].split('=')[1];
    const row = await db.getSession(id, now);
    assert.equal(row.expires, now + 7 * 86400000);
    assert(!row.body.includes('refresh-' + sequence), 'refresh token is encrypted at rest');
    return id;
  };
  const id = await freshLogin(), end = (await db.getSession(id, now)).expires;
  assert.equal((await api.viewer(request(id))).id, 'user-1');
  assert.equal(refreshes, 0);
  now += 3550000;
  const viewers = await Promise.all(Array.from({length: 8}, () => api.viewer(request(id))));
  assert(viewers.every(v => v.id === 'user-1'));
  assert.equal(refreshes, 1, 'concurrent readers rotate the refresh token once');
  assert.equal((await db.getSession(id, now)).expires, end, 'renewal does not slide the seven-day limit');
  const renewed = JSON.parse((await db.getSession(id, now)).body);
  assert.equal(api.openRefreshToken(renewed.refreshToken, 'test-secret', 'user-1'), 'refresh-' + sequence);
  assert.throws(() => api.openRefreshToken(renewed.refreshToken, 'test-secret', 'someone-else'));
  assert.throws(() => api.openRefreshToken(renewed.refreshToken, 'wrong-secret', 'user-1'));
  admin = false;
  await assert.rejects(api.requireAdmin(request(id)), e => e.status === 403);
  admin = true;
  // Both renewal failure and introspection failure must preserve the same session.
  now += 3600000;
  refresh = async () => { throw new DOMException('timeout', 'TimeoutError'); };
  await assert.rejects(api.viewer(request(id)), e => e.status === 503);
  assert(await db.getSession(id, now));
  assert.equal(JSON.parse((await db.getSession(id, now)).body).refreshLease, undefined);
  refresh = async () => { sequence++; return tokens(); };
  assert(await api.viewer(request(id)));
  const healthyFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('offline'); };
  await assert.rejects(api.viewer(request(id)), e => e.status === 503);
  assert(await db.getSession(id, now));
  globalThis.fetch = healthyFetch;
  assert(await api.viewer(request(id)));
  revoked = true;
  assert.equal(await api.viewer(request(id)), null, 'password change/authorization revocation deletes local session');
  assert.equal(await db.getSession(id, now), null);
  revoked = false;
  const invalid = await freshLogin(); now += 3600000;
  refresh = async () => { throw new globalThis.InvalidGrant('invalid_grant'); };
  assert.equal(await api.viewer(request(invalid)), null, 'revoked refresh grant cannot renew');
  assert.equal(await db.getSession(invalid, now), null);
  refresh = async () => { sequence++; return tokens(); };
  const expired = await freshLogin(); now += 7 * 86400000;
  const count = refreshes;
  assert.equal(await api.viewer(request(expired)), null);
  assert.equal(refreshes, count, 'absolute expiry never calls refresh');
  const race = await freshLogin(); now += 3600000;
  let release, started;
  const entered = new Promise(resolve => { started = resolve; });
  refresh = async () => { started(); await new Promise(resolve => { release = resolve; }); sequence++; return tokens(); };
  const pending = api.viewer(request(race)); await entered;
  const response = await api.logout(request(race));
  assert.match(response.headers.get('Set-Cookie'), /Max-Age=0/);
  release(); assert.equal(await pending, null);
  assert.equal(await db.getSession(race, now), null, 'in-flight refresh cannot recreate logout');
  assert(revokedTokens.includes('refresh-' + sequence), 'discarded rotated token is revoked');
  // A stale introspection result must not destroy another request's renewed body.
  refresh = async () => { sequence++; return tokens(); };
  const stale = await freshLogin();
  let finishCheck, checkStarted;
  const checking = new Promise(resolve => { checkStarted = resolve; });
  let first = true;
  globalThis.fetch = async (...args) => {
    if (first) { first = false; checkStarted(); return new Promise(resolve => { finishCheck = resolve; }); }
    return healthyFetch(...args);
  };
  const oldCheck = api.viewer(request(stale)); await checking;
  now += 3550000;
  assert(await api.viewer(request(stale)));
  finishCheck(Response.json({code:'UNAUTHORIZED'}, {status:401}));
  assert(await oldCheck); assert(await db.getSession(stale, now));
  // Old one-hour sessions remain valid until expiry; no fabricated refresh credentials.
  globalThis.fetch = healthyFetch;
  const legacy = await api.saveSession({kind:'user', sub:'user-1', name:'User', username:'user', token:'legacy'});
  assert(await api.viewer(request(legacy)));
  now += 3600000;
  assert.equal(await api.viewer(request(legacy)), null);
  console.log('PASS seven-day callback/cookie, encrypted rotated credentials, concurrent refresh, fixed expiry, network recovery, live roles/revocation, invalid grant, logout race, stale introspection and legacy sessions.');
} finally {
  Date.now = originalNow; globalThis.fetch = originalFetch;
  delete globalThis.oidcFixture; delete globalThis.InvalidGrant;
  await rm(dir, {recursive:true, force:true});
}
