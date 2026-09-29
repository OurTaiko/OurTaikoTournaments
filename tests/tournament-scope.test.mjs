import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';

const dir = await mkdtemp(tmpdir() + '/tournament-scope-');
Object.assign(process.env, {
  DATABASE_PATH: dir + '/test.sqlite', MONGODB_URI: '', MONGODB_DB: '', VERCEL: '',
  DEMO_MODE: 'false', APP_ORIGIN: 'http://127.0.0.1:5192',
  SSO_ISSUER: 'https://sso.example', SSO_CLIENT_ID: 'existing-client', SSO_CLIENT_SECRET: 'test-only',
});
const originalFetch = globalThis.fetch;
let sql;
try {
  await build({ stdin: { contents: `
    export * from './lib/store';
    export {tournamentApiPath, tournamentId} from './lib/tournaments';
    export * from './lib/tournament-scope';
    export * from './lib/tournament-access';
    export * from './lib/tournament-seed';
    export * from './lib/tournament';
    export * from './lib/demo-song-library';
    export {GET as directory} from './app/api/tournaments/route';
    export {GET as state} from './app/api/tournaments/[series]/[edition]/route';
    export {GET as songs} from './app/api/tournaments/[series]/[edition]/songs/route';
    export {GET as access} from './app/api/tournaments/[series]/[edition]/access/route';
    export {GET as match, POST as score} from './app/api/tournaments/[series]/[edition]/matches/[id]/route';
    export {POST as players} from './app/api/tournaments/[series]/[edition]/players/route';
    export {POST as reset} from './app/api/tournaments/[series]/[edition]/reset/route';
    export {GET as legacyState} from './app/api/tournament/route';
    export {GET as legacySongs} from './app/api/songs/route';
    export {GET as legacyMatch, POST as legacyScore} from './app/api/matches/[id]/route';
    export {POST as legacyPlayers} from './app/api/players/route';
    export {POST as legacyReset} from './app/api/tournament/reset/route';
  `, resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'cjs', conditions: ['react-server'], outfile: dir + '/test.cjs' });
  const api = (await import(dir + '/test.cjs')).default;
  const db = api.db();
  assert.equal(api.tournamentId('hachicats', '20260927'), 'hachicats-20260927');
  assert.equal(api.tournamentId('other-series', '20270101'), 'other-series-20270101');
  assert.throws(() => api.tournamentId('../hachicats', '20260927'));
  assert.throws(() => api.tournamentId('hachicats', '../20260927'));
  const publicId = 'hachicats-20260927';
  const base = process.env.APP_ORIGIN + '/api/tournaments/hachicats/20260927';
  const context = (series = 'hachicats', id = 'siamese-r0-2', edition = '20260927') => ({ params: Promise.resolve({ series, edition, id }) });
  const request = (path = '', body, auth = true, origin = process.env.APP_ORIGIN) => new Request(base + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Origin: origin, ...(auth ? { Cookie: 'hachicats_session=test-user' } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const snapshot = async id => ({ ...await db.getTournament(id) });
  const event = api.makeTournament(true);
  event.revision = 42;
  event.updatedAt = '2026-09-27T12:34:56.000Z';
  event.matches[2].revision = 40;
  const hidden = event.matches.find(m => m.id === 'siamese-r3-0');
  hidden.picks = [['siamese-1', 'siamese-2'], ['siamese-3', 'siamese-4']];
  hidden.bans = ['siamese-3', 'siamese-1'];
  hidden.scores = [{songId:'special:siamese:final', a:123, b:456}];
  const row = { id: 'hachicats-20260927', revision: 42, body: JSON.stringify(api.tournamentState(event), null, 2) };
  await db.createTournament(row);
  // Unrelated records deliberately reuse the same match IDs. Scope must choose the parent document.
  await db.createTournament({ ...row, id: 'another-tournament' });
  await db.createTournament({ ...row, id: 'demo' });
  const library = api.demoSongLibrary('hachicats-20260927');
  library.designated.siamese.final = { songID: 900001, difficultyIndex: 5 };
  await db.createSongLibrary(library);
  await db.createSongLibrary(api.demoSongLibrary('demo'));
  await db.saveSession({ id: 'test-user', body: JSON.stringify({kind:'user', sub:'stable-user', token:'test-token'}), expires: Date.now() + 120000 });
  sql = new DatabaseSync(process.env.DATABASE_PATH);
  const libraryBytes = sql.prepare('SELECT body FROM song_libraries WHERE id=?').get('hachicats-20260927').body;
  let admin = true, unavailable = false, networkCalls = 0;
  globalThis.fetch = async url => {
    networkCalls++;
    if (String(url).includes('/internal/v1/web/introspect')) {
      if (unavailable) throw Error('SSO unavailable');
      return Response.json({user:{id:'stable-user',username:'existing-user',nickname:'Existing admin',isAdmin:admin}, expiresAt:new Date(Date.now()+60000).toISOString()});
    }
    assert.equal(String(url), 'https://cdn.ourtaiko.org/api/cnsongs');
    return Response.json([...Array.from({length:14}, (_, i) => ({id:i+1,song_name:'Sample '+(i+1),level_4:8})), {id:900001,song_name:'PRIVATE TEST SENTINEL',level_5:10}]);
  };
  assert.equal(api.tournamentStorageId(api.resolveTournamentScope(publicId, false)), 'hachicats-20260927');
  assert.equal(api.tournamentStorageId(api.resolveTournamentScope(publicId, true)), 'demo');
  assert.equal(api.tournamentApiPath(publicId), '/api/tournaments/hachicats/20260927');
  const listing = await api.directory().json();
  assert.deepEqual(listing.tournaments.map(t => t.id), [publicId, 'centurylink-20261227']);
  assert(!JSON.stringify(listing).includes('storageId'));

  const publicState = await api.state(request(), context());
  assert.equal(publicState.status, 200);
  assert.equal(publicState.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(await publicState.json(), await (await api.legacyState()).json());
  const publicSongs = await api.songs(request('/songs'), context());
  assert.equal(publicSongs.status, 200);
  const publicCatalog = await publicSongs.json();
  assert(!JSON.stringify(publicCatalog).includes('900001'));
  assert(!JSON.stringify(publicCatalog).includes('PRIVATE TEST SENTINEL'));
  assert.deepEqual(publicCatalog, await (await api.legacySongs()).json());
  const matchContext = context('hachicats', hidden.id);
  const privateMatch = await api.match(request('/matches/'+hidden.id), matchContext);
  assert.equal(privateMatch.status, 200);
  assert.equal(privateMatch.headers.get('Cache-Control'), 'no-store');
  const detail = await privateMatch.json();
  assert.equal(detail.designated.title, 'PRIVATE TEST SENTINEL');
  assert.equal(detail.revision, 42);
  assert.deepEqual(detail, await (await api.legacyMatch(request(), {params:Promise.resolve({id:hidden.id})})).json());
  assert.deepEqual(await snapshot('hachicats-20260927'), row, 'Scoped/legacy reads cannot rewrite bytes, IDs, scores, advancement, or revision');
  assert.equal(sql.prepare('SELECT body FROM song_libraries WHERE id=?').get('hachicats-20260927').body, libraryBytes);
  assert.equal(await db.getTournament('edition-1'), null, 'Legacy storage ID must not be recreated');
  console.log('PASS existing event maps in place; scoped and legacy reads agree and preserve exact stored bytes/revisions and song mappings.');

  const methods = ['getTournament','getSongLibrary','createTournament','createSongLibrary','updateTournament','saveTournamentBackup','getSession'];
  const originals = Object.fromEntries(methods.map(name => [name, db[name]]));
  let storageCalls = 0;
  for (const name of methods) db[name] = async (...args) => { storageCalls++; return originals[name](...args); };
  const initialNetworkCalls = networkCalls;
  try {
    for (const invalid of ['other', 'edition-1', 'demo', 'another-tournament', '__proto__', 'constructor', '../edition-1']) {
      for (const [handler, body] of [[api.state], [api.songs], [api.access], [api.match], [api.score,{}], [api.players,{}], [api.reset,{}]]) {
        assert.equal((await handler(request('',body),context(invalid))).status,404);
      }
    }
    for (const edition of ['20260928', 'edition-1', 'demo', '../20260927']) {
      for (const [handler, body] of [[api.state], [api.songs], [api.access], [api.match], [api.score,{}], [api.players,{}], [api.reset,{}]]) {
        assert.equal((await handler(request('',body),context('hachicats', 'siamese-r0-2', edition))).status,404);
      }
    }
    assert.equal(storageCalls,0,'Unknown IDs must fail before reading or creating any record, even with a valid admin cookie');
    assert.equal(networkCalls,initialNetworkCalls);
  } finally { for (const name of methods) db[name] = originals[name]; }

  assert.equal((await api.match(request('',undefined,false),context())).status,401);
  assert.equal((await api.score(request('',{},false),context())).status,401);
  assert.equal((await api.players(request('',{},false),context())).status,401);
  assert.equal((await api.reset(request('',{},false),context())).status,401);
  assert.deepEqual(await (await api.access(request('',undefined,false),context())).json(),{canManage:false});
  assert.deepEqual(await (await api.access(request(),context())).json(),{canManage:true});
  admin=false;
  for (const [handler,body] of [[api.match], [api.score,{}], [api.players,{}], [api.reset,{}]]) assert.equal((await handler(request('',body),context())).status,403);
  assert.deepEqual(await (await api.access(request(),context())).json(),{canManage:false});
  unavailable=true;
  for (const [handler,body] of [[api.access], [api.match], [api.score,{}], [api.players,{}], [api.reset,{}]]) assert.equal((await handler(request('',body),context())).status,503);
  unavailable=false; admin=true;
  for (const handler of [api.score,api.players,api.reset]) assert.equal((await handler(request('',{},true,'https://untrusted.example'),context())).status,403);
  assert.deepEqual(await snapshot('hachicats-20260927'),row);
  console.log('PASS unknown/raw storage IDs fail before I/O; scoped roles, revocation, SSO failure, anonymous access and Origin checks fail closed.');

  const live = event.matches[2];
  const save = {type:'save',revision:42,matchRevision:40,scores:live.scores.map(s=>({...s,a:765432,b:654321}))};
  assert.equal((await api.score(request('',save),context())).status,200);
  const next = await snapshot('hachicats-20260927');
  assert.equal(next.revision,43);
  const nextEvent = JSON.parse(next.body), oldEvent = JSON.parse(row.body);
  assert.deepEqual(nextEvent.rosters,oldEvent.rosters);
  assert.deepEqual(nextEvent.matches.map(m=>m.id),oldEvent.matches.map(m=>m.id));
  assert.deepEqual(nextEvent.matches.filter(m=>m.id!==live.id),oldEvent.matches.filter(m=>m.id!==live.id),'Only the submitted match changes');
  assert.equal(nextEvent.matches.find(m=>m.id===live.id).revision,43);
  assert.equal((await api.legacyScore(request('',save),{params:Promise.resolve({id:live.id})})).status,409,'Legacy clients share the same revision guard');
  assert.equal((await api.score(request('',save),context())).status,409);
  const legacySave = {...save,revision:43,matchRevision:43};
  assert.equal((await api.legacyScore(request('',legacySave),{params:Promise.resolve({id:live.id})})).status,200);
  assert.equal((await snapshot('hachicats-20260927')).revision,44);
  const staleReset = {revision:42,confirmation:'重置第一届八猫杯'};
  assert.equal((await api.reset(request('',staleReset),context())).status,409);
  assert.equal((await api.legacyReset(request('',staleReset))).status,409);
  assert.equal((await api.legacyPlayers(request('',{},false))).status,401);
  assert.equal((await snapshot('another-tournament')).body,row.body);
  assert.equal((await snapshot('demo')).body,row.body);
  assert.equal(sql.prepare('SELECT body FROM song_libraries WHERE id=?').get('hachicats-20260927').body,libraryBytes);
  assert.equal(await db.getTournament('edition-1'),null);

  process.env.DEMO_MODE='true';
  const demoPublic = await (await api.state(request(),context())).json();
  assert.equal(demoPublic.demo,true); assert.equal(demoPublic.tournament.revision,42);
  assert.equal((await snapshot('hachicats-20260927')).revision,44);
  assert.equal(api.canManageTournament(api.resolveTournamentScope(publicId,false),{admin:true,demo:true}),false,'Demo identity cannot authorize production scope');
  console.log('PASS scoped/legacy writes use the same CAS, preserve unrelated matches and records, retain library references, and isolate demo from hachicats-20260927.');
} finally {
  sql?.close();
  globalThis.fetch=originalFetch;
  await rm(dir,{recursive:true,force:true});
}
