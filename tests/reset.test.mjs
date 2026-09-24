import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
const dir = await mkdtemp(tmpdir() + '/hachicats-reset-');
Object.assign(process.env, { DATABASE_PATH: dir + '/test.sqlite', MONGODB_URI: '', VERCEL: '', DEMO_MODE: 'true', APP_ORIGIN: 'http://127.0.0.1:5192' });
try {
  await build({ stdin: { contents: "export {demoSongLibrary} from './lib/demo-song-library'; export { POST } from './app/api/tournament/reset/route'; export { runtime } from './lib/runtime'; export { resetTournament } from './lib/reset-tournament'; export { makeTournament,tournamentState } from './lib/tournament';", resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'cjs', outfile: dir + '/test.cjs' });
  const { demoSongLibrary, POST, runtime, resetTournament, makeTournament, tournamentState } = (await import(dir + '/test.cjs')).default;
  const db = runtime.DB;
  const library = demoSongLibrary();
  await db.createSongLibrary(library);
  const initial = makeTournament(true); initial.revision = 7;
  const row = { id: 'demo', revision: 7, body: JSON.stringify(tournamentState(initial)) };
  await db.createTournament(row);
  await db.createTournament({ ...row, id: 'edition-1' });
  await db.bindAdmin({ username: 'test-admin', subject: 'sub', issuer: 'test' });
  await db.saveSession({ id: 'test-session', body: JSON.stringify({ kind: 'demo' }), expires: Date.now() + 60000 });
  const sql = new DatabaseSync(process.env.DATABASE_PATH);
  const request = (body, cookie = true, origin = process.env.APP_ORIGIN) => new Request(process.env.APP_ORIGIN + '/api/tournament/reset', { method: 'POST', headers: { Origin: origin, ...(cookie ? { Cookie: 'hachicats_session=test-session' } : {}) }, body: typeof body === 'string' ? body : JSON.stringify(body) });
  const input = { revision: 7, confirmation: '重置演示赛事' };
  assert.equal((await POST(request(input, false))).status, 401);
  assert.equal((await POST(request(input, true, 'https://evil.example'))).status, 403);
  assert.equal((await POST(request('{'))).status, 400);
  assert.equal((await POST(request(' '.repeat(2049)))).status, 413);
  for (const bad of [null, {}, { ...input, confirmation: '重置第一届八猫杯' }, { ...input, revision: '7' }]) assert.equal((await POST(request(bad))).status, 400);
  assert.equal((await POST(request({ ...input, revision: 6 }))).status, 409);
  assert.deepEqual({ ...await db.getTournament('demo') }, row);
  await assert.rejects(resetTournament({ ...db, saveTournamentBackup: async () => { throw Error('backup unavailable'); } }, true, input, 'tester'));
  assert.deepEqual({ ...await db.getTournament('demo') }, row, 'Backup failure must not reset');
  // A competing score save after the snapshot must win over the stale reset.
  await assert.rejects(resetTournament({ ...db, saveTournamentBackup: async (backup) => {
    await db.saveTournamentBackup(backup);
    await db.updateTournament({ ...row, revision: 8 }, 7);
  } }, true, input, 'tester'), e => e.status === 409);
  assert.equal((await db.getTournament('demo')).revision, 8);
  const response = await POST(request({ ...input, revision: 8 }));
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.tournament.revision, 9);
  assert.equal(result.tournament.matches.length, 48);
  for (const match of result.tournament.matches) {
    assert.equal(match.status, 'pending'); assert.equal(match.winner, null);
    assert.deepEqual(match.scores, []); assert.equal(match.published, false);
    if (match.round > 0) { assert.equal(match.a, null); assert.equal(match.b, null); }
  }
  const stored = JSON.parse((await db.getTournament('demo')).body);
  assert(stored.matches.every(m => !m.a || !('rating' in m.a)), 'Preserve player references');
  const backup = sql.prepare('SELECT * FROM tournament_backups WHERE id=?').get(result.backupId);
  assert.equal(backup.body, row.body); assert.equal(backup.revision, 8); assert.equal(backup.actor, 'demo');
  assert.equal((await POST(request({ ...input, revision: 8 }))).status, 409, 'Duplicate request rejected');
  assert.equal(await db.updateTournament({ ...row, revision: 8 }, 7), false, 'Old editor cannot overwrite reset');
  assert.equal((await db.getTournament('edition-1')).body, row.body, 'Demo reset must not touch production');
  assert(await db.getSession('test-session', Date.now())); assert(await db.hasAdmin(['test-admin'], 'test', 'sub'));
  const production = await resetTournament(db, false, { revision: 7, confirmation: '重置第一届八猫杯' }, 'test-admin');
  assert.equal(production.tournament.revision, 8); assert.equal((await db.getTournament('demo')).revision, 9);
  assert.deepEqual(await db.getSongLibrary('demo'), library, 'Tournament reset must preserve the configured song library');
  sql.close();
  console.log('PASS reset API auth/origin/body validation, full reset, exact backup, backup failure, racing score save, monotonic revision, replay rejection and demo/production isolation.');
} finally { await rm(dir, { recursive: true, force: true }); }
