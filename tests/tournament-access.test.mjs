import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';

const dir = await mkdtemp(tmpdir() + '/tournament-access-');
Object.assign(process.env, {
  DATABASE_PATH: dir + '/test.sqlite', MONGODB_URI: '', MONGODB_DB: '', VERCEL: '', DEMO_MODE: 'false',
  APP_ORIGIN: 'http://127.0.0.1:5192', SSO_ISSUER: 'https://sso.example', SSO_CLIENT_ID: 'test-client', SSO_CLIENT_SECRET: 'test-only',
});
const originalFetch = globalThis.fetch;
try {
  await build({ stdin: { contents: `
    export * from './lib/tournament-access';
    export * from './lib/tournament-people';
    export * from './lib/sso-profiles.server';
    export * from './lib/tournament-scope';
    export {db} from './lib/store';
    export {GET as access} from './app/api/tournaments/[series]/[edition]/access/route';
    export {GET as organizers} from './app/api/tournaments/[series]/[edition]/organizers/route';
  `, resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'cjs', conditions: ['react-server'], outfile: dir + '/test.cjs',

  });
  const api = (await import(dir + '/test.cjs')).default;
  const hachi = api.resolveTournamentScope('hachicats-20260927', false);
  const century = api.resolveTournamentScope('centurylink-20261227', false);
  const demo = api.resolveTournamentScope('hachicats-20260927', true);
  const db = api.db();
  await db.createTournament({id:'hachicats-20260927',revision:0,body:'{}'}, {organizers:['grace0512','Nue'],admins:['event-admin','grace0512']});
  await db.createTournament({id:'centurylink-20261227',revision:0,body:'{}'}, {organizers:['fei'],admins:[]});
  await db.createTournament({id:'demo',revision:0,body:'{}'}, {organizers:['demo-host'],admins:[]});
  await db.createTournament({id:'old-event',revision:0,body:'{}'});
  assert.deepEqual(await db.getTournamentPeople('old-event'),{organizers:[],admins:[]});
  assert.equal(await db.getTournamentPeople('missing'),null);
  await db.createTournament({id:'centurylink-20261227',revision:0,body:'{}'}, {organizers:['replacement'],admins:[]});
  assert.deepEqual(await db.getTournamentPeople('centurylink-20261227'),{organizers:['fei'],admins:[]});
  assert.equal(await api.canManageTournament(demo,{id:'d',username:'fei',admin:false,demo:false}),false);
  const identity = (username, admin = false, demo = false) => ({id:'verified-sub', username, name:'grace0512', admin, demo});
  for (const [username, hachiGrant, centuryGrant] of [
    ['grace0512',true,false], ['Nue',true,false], ['fei',false,true], ['event-admin',true,false],
    ['nue',false,false], ['FEI',false,false], ['ordinary',false,false],
  ]) {
    assert.equal(await api.canManageTournament(hachi, identity(username)), hachiGrant, username);
    assert.equal(await api.canManageTournament(century, identity(username)), centuryGrant, username);
    for (const scope of [hachi, century]) assert.equal(await api.canManageTournament(scope, identity(username,true)),true);
  }
  assert.equal(await api.canManageTournament(hachi,null),false);
  assert.equal(await api.canManageTournament(hachi,identity('grace0512',true,true)),false);
  assert.equal(await api.canManageTournament(demo,identity('local-demo',true,true)),true);
  assert.equal(await api.canManageTournament(demo,identity('grace0512',false,true)),false);
  for (const bad of [{}, {organizers:[''],admins:[]}, {organizers:[' owner'],admins:[]}, {organizers:[],admins:[17]}])
    assert.throws(() => api.parseTournamentPeople(bad));
  // Permissions change on the next read, without rebuilding or touching scores/revisions.
  const sql = new DatabaseSync(process.env.DATABASE_PATH);
  const originalRow = await db.getTournament('hachicats-20260927');
  sql.prepare('UPDATE tournaments SET people=? WHERE id=?').run(JSON.stringify({organizers:[],admins:[]}), 'hachicats-20260927');
  assert.equal(await api.canManageTournament(hachi,identity('grace0512')),false);
  sql.prepare('UPDATE tournaments SET people=? WHERE id=?').run(JSON.stringify({organizers:['grace0512','Nue'],admins:['event-admin']}), 'hachicats-20260927');
  assert.deepEqual(await db.getTournament('hachicats-20260927'),originalRow);
  sql.close();

  await db.saveSession({id:'test-user',body:JSON.stringify({kind:'user',sub:'verified-sub',token:'test-token',username:'grace0512',admin:true}),expires:Date.now()+120000});
  const req = () => new Request(process.env.APP_ORIGIN+'/api/tournaments/hachicats/20260927/access', {headers:{Cookie:'hachicats_session=test-user'}});
  const context = (series='hachicats',edition='20260927') => ({params:Promise.resolve({series,edition})});
  let current = identity('ordinary'), failure = '', calls = 0;
  globalThis.fetch = async (url, options) => {
    calls++;
    assert.equal(new URL(url).pathname,'/internal/v1/web/introspect');
    assert.equal(options.cache,'no-store');
    if (failure==='outage') throw Error('unavailable');
    if (failure==='invalid') return Response.json({code:'UNAUTHORIZED'},{status:401});
    return Response.json({user:{id:failure==='mismatch'?'wrong-sub':current.id, username:current.username, nickname:current.name, isAdmin:current.admin},expiresAt:new Date(Date.now()+60000).toISOString()});
  };
  assert.equal((await api.access(req(),context())).status,200);
  assert.deepEqual(await (await api.access(req(),context())).json(),{canManage:false},'Stored session names/admin flags cannot grant access');
  for (const username of ['grace0512','Nue','event-admin']) {
    current=identity(username);
    assert.equal((await api.requireTournamentAdmin(req(),hachi)).username,username);
    await assert.rejects(api.requireTournamentAdmin(req(),century),error=>error.status===403);
  }
  current=identity('fei');
  await api.requireTournamentAdmin(req(),century);
  await assert.rejects(api.requireTournamentAdmin(req(),hachi),error=>error.status===403);
  current=identity('ordinary',true);
  await api.requireTournamentAdmin(req(),hachi); await api.requireTournamentAdmin(req(),century);
  current=identity('ordinary',false);
  await assert.rejects(api.requireTournamentAdmin(req(),hachi),error=>error.status===403);
  current=identity('grace0512',false);
  await api.requireTournamentAdmin(req(),hachi); // Removing website role preserves the separate organizer grant.
  for (failure of ['outage','mismatch']) assert.equal((await api.access(req(),context())).status,503);
  failure='invalid'; assert.equal((await api.access(req(),context())).status,200);
  assert.equal(await db.getSession('test-user',Date.now()),null);
  assert.deepEqual(await (await api.access(req(),context())).json(),{canManage:false});
  assert(calls>=12);

  let lookupCalls=0;
  globalThis.fetch = async (url,options) => {
    lookupCalls++;
    assert.equal(new URL(url).pathname,'/internal/v1/users/lookup');
    assert.deepEqual(JSON.parse(options.body),{usernames:['fei']});
    assert.equal(options.headers['X-Service-Key'],'test-only');
    return Response.json({users:[{username:'fei',nickname:'测试昵称'}, {username:'unrelated',nickname:'ignored'}]});
  };
  const liveContext=()=>context('centurylink','20261227');
  const response=await api.organizers(new Request(process.env.APP_ORIGIN),liveContext());
  assert.deepEqual(await response.json(),{organizerNames:['测试昵称']});
  assert.equal(response.headers.get('Cache-Control'),'no-store');
  const getPeople=db.getTournamentPeople;
  db.getTournamentPeople=async()=>{throw Error('Archive must not read the database')};
  assert.deepEqual(await (await api.organizers(req(),context())).json(),{organizerNames:['涵涵','鵺']});
  db.getTournamentPeople=getPeople;
  assert.equal((await api.organizers(req(),context('unknown'))).status,404);
  assert.equal(lookupCalls,1,'Unknown and archived events must not query SSO');
  globalThis.fetch=async()=>Response.json({users:[{username:'Nue',nickname:'改名后'}, {username:'grace0512',nickname:17}]});
  await assert.rejects(api.organizerNicknames(['grace0512','Nue']),error=>error.status===503);
  const missing=await api.organizers(req(),liveContext());
  assert.equal(missing.status,503);
  const missingBody=await missing.text();
  assert(!missingBody.includes('grace0512') && !missingBody.includes('Nue'));
  globalThis.fetch=async()=>Response.json({users:[{username:'Nue',nickname:'改名后'}, {username:'grace0512',nickname:'主办昵称'}]});
  assert.deepEqual(await api.organizerNicknames(['grace0512','Nue']),['主办昵称','改名后']);
  for (const fallback of [async()=>{throw Error('offline')},async()=>new Response('',{status:403}),async()=>Response.json({users:null})]) {
    globalThis.fetch=fallback;
    await assert.rejects(api.organizerNicknames(['grace0512','Nue']),error=>error.status===503);
  }
  delete process.env.SSO_CLIENT_SECRET;
  await assert.rejects(api.organizerNicknames(['grace0512']),error=>error.status===503);
  assert.deepEqual(await api.organizerNicknames([]),[]);
  console.log('PASS exact username union, event isolation, live SSO verification/revocation, demo boundary, config validation and public nickname lookup; missing nicknames fail without exposing usernames.');
} finally {
  globalThis.fetch=originalFetch;
  await rm(dir,{recursive:true,force:true});
}
