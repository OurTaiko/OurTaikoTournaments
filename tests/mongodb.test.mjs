import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { MongoClient } from 'mongodb';

assert(process.env.MONGODB_URI && process.env.MONGODB_DB, 'Run with --env-file=<private MongoDB env>');
await mkdir('.data', { recursive: true });
const dir = await mkdtemp(resolve('.data/mongodb-test-'));
const id = 'integration-' + randomUUID();
const clients = [0, 1].map(() => new MongoClient(process.env.MONGODB_URI, { maxPoolSize: 2, serverSelectionTimeoutMS: 10000 }));
try {
  await build({ entryPoints: ['lib/mongodb.ts'], bundle: true, platform: 'node', format: 'cjs', external: ['mongodb'], outfile: dir + '/mongodb.cjs' });
  const { default: { mongoDatabase } } = await import(dir + '/mongodb.cjs');
  const databases = clients.map(c => c.db(process.env.MONGODB_DB));
  const adapters = databases.map(d => mongoDatabase(async () => d));
  await adapters[0].ping();
  await adapters[0].saveTournamentBackup({ id, tournamentId: id, revision: 3, body: 'exact prior state', actor: 'integration-test', createdAt: new Date().toISOString() });
  const backup = await databases[1].collection('tournament_backups').findOne({ _id: id });
  assert.equal(backup.body, 'exact prior state');
  assert.equal(backup.revision, 3);
  await assert.rejects(adapters[1].saveTournamentBackup({ id, tournamentId: id, revision: 4, body: 'overwrite', actor: 'integration-test', createdAt: new Date().toISOString() }));
  assert.equal((await databases[0].collection('tournament_backups').findOne({ _id: id })).body, 'exact prior state');
  await adapters[0].createTournament({ id, revision: 0, body: 'initial' });
  await adapters[1].createTournament({ id, revision: 0, body: 'overwrite' });
  assert.equal((await adapters[1].getTournament(id)).body, 'initial');
  const results = await Promise.all(Array.from({ length: 12 }, (_, i) => adapters[i % 2].updateTournament({ id, revision: 1, body: 'winner-' + i }, 0)));
  assert.equal(results.filter(Boolean).length, 1, 'Exactly one concurrent update must win');
  assert.equal((await adapters[1].getTournament(id)).revision, 1);
  const expires = Date.now() + 60000;
  await adapters[0].saveSession({ id, body: 'test-session', expires });
  assert(await adapters[1].getSession(id, expires - 1));
  assert.equal(await adapters[1].getSession(id, expires), null);
  assert.equal((await Promise.all(adapters.map(a => a.deleteSession(id)))).filter(Boolean).length, 1);
  await adapters[0].bindAdmin({ username: id, subject: 'original', issuer: 'test-issuer' });
  await adapters[1].bindAdmin({ username: id, subject: 'replacement', issuer: 'test-issuer' });
  assert(await adapters[0].hasAdmin([id], 'test-issuer', 'original'));
  assert.equal(await adapters[1].hasAdmin([id], 'test-issuer', 'replacement'), false);
  assert.equal(await adapters[1].hasAdmin([], 'test-issuer', 'original'), false);
  console.log('PASS Atlas cross-client persistence, concurrent revision updates, session expiry/one-use deletion and immutable administrator binding.');
} finally {
  // Only the uniquely named records created by this run are removed.
  for (const collection of ['tournaments', 'sessions', 'admins', 'tournament_backups'])
    await clients[0].db(process.env.MONGODB_DB).collection(collection).deleteOne({ _id: id });
  await Promise.all(clients.map(c => c.close()));
  await rm(dir, { recursive: true, force: true });
}
