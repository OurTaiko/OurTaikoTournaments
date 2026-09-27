import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const dir = await mkdtemp(tmpdir() + '/hachicats-roster-test-');
Object.assign(process.env, { DATABASE_PATH: dir + '/test.sqlite', MONGODB_URI: '', VERCEL: '', DEMO_MODE: 'true', APP_ORIGIN: 'http://127.0.0.1:5193' });
try {
  await build({ stdin: { contents: `export * from './lib/player-management'; export * from './lib/tournament-seed'; export * from './lib/store'; export * from './lib/migrate-players'; export * from './lib/reset-tournament'; export {POST} from './app/api/players/route';`, resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'cjs', outfile: dir + '/test.cjs' });
  const { makeTournament, applyPlayerAction, reserves, readTournament, db, POST, migratePlayers, resetTournament } = (await import(pathToFileURL(dir + '/test.cjs').href)).default;
  const initial = makeTournament();
  const replace = (t, playerId, side = 'a', matchId = 'siamese-r0-0') => applyPlayerAction(t, { type: 'replace', matchId, side, playerId });
  const swapped = replace(initial, 'siamese-p2');
  assert.equal(swapped.matches[0].a.id, 'siamese-p2');
  assert.equal(swapped.matches[1].a.id, 'siamese-p0');
  assert.equal(swapped.matches[0].a.seed, 1);
  assert.equal(swapped.matches[1].a.seed, 3);
  assert.equal(initial.matches[0].a.id, 'siamese-p0');
  const sameMatch = replace(initial, 'siamese-p1');
  assert.equal(sameMatch.matches[0].a.id, 'siamese-p1');
  assert.equal(sameMatch.matches[0].b.id, 'siamese-p0');
  assert.equal(reserves(sameMatch, 'siamese').length, 0);
  let withReserve = applyPlayerAction(initial, { type: 'add', group: 'siamese', name: '  替补甲  ', rating: 8.25 });
  const added = withReserve.rosters.siamese.at(-1);
  assert.equal(added.name, '替补甲');
  assert.deepEqual(reserves(withReserve, 'siamese').map(p => p.id), [added.id]);
  withReserve.matches[0].picks = [['siamese-1', 'siamese-2'], ['siamese-3', 'siamese-4']];
  withReserve = replace(withReserve, added.id);
  assert.equal(withReserve.matches[0].a.id, added.id);
  assert.deepEqual(reserves(withReserve, 'siamese').map(p => p.id), ['siamese-p0']);
  assert.deepEqual(withReserve.matches[0].picks, [[], []]);
  assert.deepEqual(withReserve.matches.slice(1), initial.matches.slice(1));
  const restored = replace(withReserve, 'siamese-p0');
  assert.equal(restored.matches[0].a.id, 'siamese-p0');
  assert.deepEqual(reserves(restored, 'siamese').map(p => p.id), [added.id]);
  for (const playerId of ['tabby-p0', 'missing', 'siamese-p0']) assert.throws(() => replace(initial, playerId));
  assert.throws(() => replace(initial, 'siamese-p2', 'a', 'siamese-r1-0'));
  for (const index of [0, 1]) for (const status of ['live', 'complete', 'bye']) {
    const t = structuredClone(initial); t.matches[index].status = status;
    assert.throws(() => replace(t, 'siamese-p2'));
  }
  for (const patch of [{ published: true }, { winner: 'siamese-p0' }, { scores: [{ songId: 'siamese-1', a: 0, b: null }] }]) {
    const t = structuredClone(initial); Object.assign(t.matches[0], patch);
    assert.throws(() => replace(t, 'siamese-p2'));
  }
  const advanced = makeTournament(true);
  const edited = applyPlayerAction(advanced, { type: 'edit', id: 'siamese-p0', name: '新版姓名', rating: 9.12 });
  for (const m of edited.matches) for (const side of ['a', 'b']) if (m[side]?.id === 'siamese-p0') {
    assert.equal(m[side].name, '新版姓名'); assert.equal(m[side].rating, 9.12);
  }
  const withoutPlayers = matches => matches.map(m => Object.fromEntries(Object.entries(m).filter(([key]) => !['a', 'b', 'revision'].includes(key))));
  assert.deepEqual(withoutPlayers(edited.matches), withoutPlayers(advanced.matches));
  for (const patch of [{ name: ' ' }, { name: 'x'.repeat(61) }, { rating: -1 }, { rating: 1.234 }, { rating: '9' }, { rating: Infinity }, { id: 'missing' }, { seed: 99 }])
    assert.throws(() => applyPlayerAction(initial, { type: 'edit', id: 'siamese-p0', name: 'valid', rating: 8, ...patch }));
  console.log('PASS swap across/same match, reserve replacement/restoration, stable IDs, unplayed draft clearing, locked games, group isolation and profile validation.');

  const database = db();
  await readTournament();
  await database.saveSession({ id: 'roster-test', body: JSON.stringify({ kind: 'demo' }), expires: Date.now() + 60000 });
  const request = (input, auth = true, origin = process.env.APP_ORIGIN) => new Request(origin + '/api/players', { method: 'POST', headers: { Origin: origin, ...(auth ? { Cookie: 'hachicats_session=roster-test' } : {}) }, body: typeof input === 'string' ? input : JSON.stringify(input) });
  const action = { type: 'edit', id: 'siamese-p0', name: '数据库姓名', rating: 10.25 };
  assert.equal((await POST(request({ revision: 0, action }, false))).status, 401);
  assert.equal((await POST(request({ revision: 0, action }, true, 'https://evil.example'))).status, 403);
  for (const input of ['{', null, {}, { revision: '0', action }, { revision: 0, action: {} }]) assert.equal((await POST(request(input))).status, 400);
  assert.equal((await POST(request(' '.repeat(4097)))).status, 413);
  const responses = await Promise.all([POST(request({ revision: 0, action })), POST(request({ revision: 0, action }))]);
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
  const response = responses.find(r => r.status === 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const result = await response.json();
  assert(result.tournament.matches.filter(m => !m.published).every(m => m.scores.length === 0 && m.picks.flat().length === 0));
  const persisted = await readTournament();
  assert.equal(persisted.rosters.siamese[0].name, action.name);
  assert.equal(persisted.matches[0].a.rating, action.rating);
  const reset = await resetTournament(database, true, { revision: 1, confirmation: '重置演示赛事' }, 'tester');
  assert.deepEqual(reset.tournament.rosters, persisted.rosters);
  console.log('PASS authenticated API, Origin/body validation, atomic competing edits, stale rejection, public filtering, database hydration and roster-preserving reset.');

  const legacy = makeTournament(true); delete legacy.rosters;
  const row = { id: 'edition-1', revision: legacy.revision, body: JSON.stringify(legacy) };
  await database.createTournament(row);
  await assert.rejects(migratePlayers(database, false), /not been migrated/);
  await assert.rejects(migratePlayers({ ...database, saveTournamentBackup: async () => { throw Error('backup failed'); } }, true));
  assert.equal((await database.getTournament('edition-1')).body, row.body);
  const migration = await migratePlayers(database, true);
  assert.deepEqual(migration, { migrated: true, revision: 1, players: 48 });
  const migrated = JSON.parse((await database.getTournament('edition-1')).body);
  assert.deepEqual(migrated.matches, legacy.matches, 'Migration must leave all match bytes/data intact');
  assert.equal((await migratePlayers(database, true)).migrated, false);
  console.log('PASS legacy migration backup failure, unchanged scores/advancement, monotonic revision and idempotent re-run.');
} finally { await rm(dir, { recursive: true, force: true }); }
