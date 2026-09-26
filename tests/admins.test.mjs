import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
const dir = await mkdtemp(tmpdir() + '/hachicats-admins-');
Object.assign(process.env, { DATABASE_PATH: dir + '/test.sqlite', MONGODB_URI: '', VERCEL: '', DEMO_MODE: 'false', APP_ORIGIN: 'https://cats.example', SSO_ISSUER: 'https://sso.example', SSO_CLIENT_ID: 'cats', SSO_CLIENT_SECRET: 'test-secret', ADMIN_USERNAMES: 'ordinary' });
const originalFetch = globalThis.fetch;
try {
  await build({ stdin: { contents: "export * from './lib/sso-session'; export {viewer,requireAdmin,saveSession} from './lib/auth'; export {runtime} from './lib/runtime';", resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'cjs', outfile: dir+'/test.cjs' });
  const { introspectSession, viewer, requireAdmin, saveSession, runtime } = (await import(pathToFileURL(dir+'/test.cjs'))).default;
  let admin = false, status = 200, code = '', malformed = false, wrongUser = false, expired = false, calls = 0;
  globalThis.fetch = async (url, init) => {
    calls++;
    assert.equal(String(url), 'https://sso.example/internal/v1/web/introspect');
    assert.equal(init.headers['X-Service-ID'], 'cats'); assert.equal(init.headers['X-Service-Key'], 'test-secret');
    assert.equal(init.headers.Origin, undefined); assert.equal(init.headers.Cookie, undefined);
    assert.equal(init.cache, 'no-store'); assert.equal(init.redirect, 'error');
    assert.deepEqual(JSON.parse(init.body), {accessToken:'test-token'});
    return Response.json(status === 200 ? {user:{id:wrongUser?'someone-else':'stable-sub',username:'ordinary',nickname:'User',isAdmin:malformed?'true':admin},expiresAt:new Date(Date.now()+(expired?-60000:60000)).toISOString()} : {code}, {status});
  };
  const id = await saveSession({kind:'user',sub:'stable-sub',username:'old-name',name:'Old',token:'test-token'});
  const request = new Request('https://cats.example/api/session', {headers:{Cookie:'hachicats_session='+id}});
  assert.equal((await viewer(request)).admin, false, 'Old environment allowlist cannot authorize');
  await assert.rejects(requireAdmin(request), e=>e.status===403);
  admin=true;
  assert.equal((await requireAdmin(request)).admin, true, 'SSO role immediately grants existing session');
  admin=false;
  await assert.rejects(requireAdmin(request), e=>e.status===403, 'Revocation must not wait for another login');
  admin=true; wrongUser=true;
  await assert.rejects(requireAdmin(request), e=>e.status===503, 'Different subject must not authorize');
  wrongUser=false; malformed=true;
  await assert.rejects(requireAdmin(request), e=>e.status===503, 'Truthy strings must not authorize');
  malformed=false;
  for (const [s,c] of [[401,'SERVICE_UNAUTHORIZED'],[403,'SERVICE_FORBIDDEN'],[503,'UNAVAILABLE']]) {
    status=s;code=c;
    await assert.rejects(requireAdmin(request), e=>e.status===503);
    assert(await runtime.DB.getSession(id,Date.now()), 'Upstream configuration failure must not destroy session');
  }
  globalThis.fetch=async()=>{throw new DOMException('timeout','TimeoutError');};
  await assert.rejects(requireAdmin(request), e=>e.status===503);
  const mockedFetch = async()=>Response.json({code:'UNAUTHORIZED'},{status:401});
  globalThis.fetch=mockedFetch;
  assert.equal(await viewer(request),null); assert.equal(await runtime.DB.getSession(id,Date.now()),null);
  await assert.rejects(requireAdmin(new Request('https://cats.example/api/private')), e=>e.status===401);
  globalThis.fetch=async()=>{throw Error('must not send credentials');};
  for(const issuer of ['http://sso.example','https://user:pass@sso.example','https://sso.example/?query=1'])
    await assert.rejects(introspectSession({...runtime,SSO_CLIENT_ID:'cats',SSO_CLIENT_SECRET:'test-secret',SSO_ISSUER:issuer},{subject:'stable-sub',token:'test-token'}),e=>e.status===503);
  assert(calls>=9);
  console.log('PASS live SSO role grant/removal, old allowlist ignored, subject binding, strict boolean, fail-closed service errors/timeouts, expired-token logout, request isolation and credential transport.');
} finally { globalThis.fetch=originalFetch; await rm(dir,{recursive:true,force:true}); }
