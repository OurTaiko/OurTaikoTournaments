import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { MongoClient } from 'mongodb';

assert(process.env.MONGODB_URI, 'Run with --env-file=<private MongoDB env>');
// Never use the configured production database, even when loading its URI.
const name = 'ott_test_' + randomUUID().replaceAll('-', '').slice(0, 24);
await mkdir('.data', { recursive: true });
const dir = await mkdtemp(resolve('.data/mongodb-test-'));
const clients = [0, 1].map(() => new MongoClient(process.env.MONGODB_URI, { maxPoolSize: 5, serverSelectionTimeoutMS: 10000 }));
try {
  await build({ stdin: { contents: `export * from './lib/mongodb'; export * from './lib/mongo-schema'; export * from './lib/migrate-tournament-schema'; export * from './lib/tournament-documents'; export * from './lib/tournament-seed'; export * from './lib/tournament'; export * from './lib/rules'; export * from './lib/reset-tournament'; export {demoSongLibrary} from './lib/demo-song-library';`, resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'cjs', external: ['mongodb'], outfile: dir + '/mongodb.cjs' });
  const api = (await import(dir + '/mongodb.cjs')).default;
  const db = clients[0].db(name);
  const adapters = clients.map(c => api.mongoDatabase(async () => c.db(name)));
  const id = 'demo';
  await api.ensureTournamentSchema(db);
  const state = api.tournamentState(api.makeTournament(false));
  const row = { id, revision: 0, body: JSON.stringify(state, null, 2) };
  await db.collection('tournaments').insertOne({ _id: id, revision: 0, body: row.body });
  assert.equal((await adapters[0].getTournament(id)).body, row.body);
  await assert.rejects(api.migrateTournamentSchema(db, id, 1, api.bodyHash(row.body)));
  assert.equal(await db.collection('matches').countDocuments(), 0);
  await api.migrateTournamentSchema(db, id, 0, api.bodyHash(row.body));
  assert.equal((await api.migrateTournamentSchema(db, id, 0, api.bodyHash(row.body))).migrated, false);
  assert.deepEqual(JSON.parse((await adapters[1].getTournament(id)).body), state);
  assert.equal((await db.collection('tournaments').findOne({ _id: id })).body, undefined);
  assert.equal((await db.collection('tournament_schema_migrations').findOne({ tournamentId: id })).source.body, row.body);
  // A pre-migration backend must be unable to append the old body back into schema 3.
  await assert.rejects(db.collection('tournaments').updateOne({ _id: id }, { $set: { body: row.body } }), e => e.code === 121);
  await adapters[0].createTournament({ ...row, id: 'other' });
  await adapters[1].createTournament({ ...row, body: JSON.stringify({ ...state, updatedAt: 'must-not-overwrite' }) });
  assert.deepEqual(JSON.parse((await adapters[1].getTournament(id)).body), state);
  const library = api.demoSongLibrary(id);
  await adapters[0].createSongLibrary(library);
  const changedLibrary = structuredClone(library); changedLibrary.designated.siamese.final.songID = 999999;
  await adapters[1].createSongLibrary(changedLibrary);
  assert.deepEqual(await adapters[0].getSongLibrary(id), library);

  const action = (station, score) => ({ type: 'start', station,
    picks: [['siamese-1', 'siamese-2'], ['siamese-3', 'siamese-4']], bans: ['siamese-3', 'siamese-1'],
    scores: [{ songId: 'siamese-2', a: score, b: 90 }, { songId: 'siamese-4', a: score, b: 80 }],
  });
  const a = 'siamese-r0-0', b = 'siamese-r0-1';
  const read = async () => api.hydrateTournament(JSON.parse((await adapters[0].getTournament(id)).body));
  const write = (next, previous, adapter = adapters[0]) => adapter.updateTournament({ id, revision: next.revision, body: JSON.stringify(api.tournamentState(next)) }, previous);
  // Two rules calculations both see an empty station. Global CAS allows only one.
  const initial = await read();
  const candidates = [a, b].map(mid => api.applyAction(initial, mid, action('A', 100), library.pools.siamese));
  const results = await Promise.all(candidates.map((next, i) => write(next, initial.revision, adapters[i])));
  assert.equal(results.filter(Boolean).length, 1);
  const won = results[0] ? a : b, lost = results[0] ? b : a;
  let current = await read();
  assert.throws(() => api.applyAction(current, lost, action('A', 110), library.pools.siamese));
  assert.equal(await write(api.applyAction(current, lost, action('B', 110), library.pools.siamese), current.revision), true);
  current = await read();
  const finished = api.applyAction(current, won, { type: 'finish' }, library.pools.siamese);
  // Force a validation failure after tournament revision is staged: all writes roll back.
  const before = await adapters[0].getTournament(id);
  await db.command({ collMod: 'matches', validator: { status: { $ne: 'complete' } }, validationLevel: 'strict' });
  await assert.rejects(write(finished, current.revision));
  assert.deepEqual(await adapters[0].getTournament(id), before);
  await api.ensureTournamentSchema(db);
  await write(finished, current.revision);
  current = await read();
  const source = current.matches.find(m => m.id === won);
  const nextRound = current.matches.find(m => m.id === 'siamese-r1-0');
  assert.equal(nextRound[won === a ? 'a' : 'b'].id, source.winner);
  assert.equal(nextRound.revision, current.revision);
  assert.deepEqual(JSON.parse((await adapters[0].getTournament('other')).body), state);

  const input = { revision: current.revision, confirmation: '重置演示赛事' };
  const resetBefore = await adapters[0].getTournament(id);
  await db.command({ collMod: 'tournament_backups', validator: { actor: { $ne: 'fail-backup' } }, validationLevel: 'strict' });
  await assert.rejects(api.resetTournament(adapters[0], true, input, 'fail-backup'));
  assert.deepEqual(await adapters[0].getTournament(id), resetBefore);
  await db.command({ collMod: 'tournament_backups', validator: {} });
  const reset = await api.resetTournament(adapters[0], true, input, 'atlas-test');
  const backup = await db.collection('tournament_backups').findOne({ _id: reset.backupId });
  assert.equal(backup.body, undefined);
  assert.deepEqual(backup.snapshot, JSON.parse(resetBefore.body));
  assert.equal(backup.schemaVersion, 3);
  assert(reset.tournament.matches.every(m => m.revision === reset.tournament.revision));
  await assert.rejects(api.resetTournament(adapters[0], true, input, 'atlas-test'), e => e.status === 409);
  assert.deepEqual(await adapters[0].getSongLibrary(id), library);
  const expires = Date.now() + 60000;
  await adapters[0].saveSession({ id: 'session', body: 'test-session', expires });
  assert(await adapters[1].getSession('session', expires - 1));
  assert.equal(await adapters[1].getSession('session', expires), null);
  assert.equal((await Promise.all(adapters.map(a => a.deleteSession('session')))).filter(Boolean).length, 1);
  // Lost child data must fail closed; never initialize an empty tournament over it.
  await db.collection('matches').deleteOne({ tournamentId: 'other' });
  await assert.rejects(adapters[0].getTournament('other'));
  console.log('PASS isolated Atlas migration/idempotency, native collections, old-writer rejection, competing stations/CAS, atomic advancement, write failure rollback, reset+backup transaction, scope isolation and sessions.');
} finally {
  await clients[0].db(name).dropDatabase(); // This unique database was created by this test only.
  await Promise.all(clients.map(c => c.close()));
  await rm(dir, { recursive: true, force: true });
}
