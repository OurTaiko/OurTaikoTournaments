import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { MongoClient } from 'mongodb';
const [snapshotPath, mode = '--verify'] = process.argv.slice(2);
assert(snapshotPath && ['--apply', '--verify'].includes(mode), 'Usage: node --env-file=<private-env> scripts/import-mongodb.mjs <snapshot.json> [--apply|--verify]');
assert(process.env.MONGODB_URI && process.env.MONGODB_DB, 'MongoDB environment missing');
const snapshot = JSON.parse(await readFile(snapshotPath, 'utf8'));
assert.equal(snapshot.format, 'hachicats-sqlite-v1');
assert(snapshot.tournaments.some(t => t.id === 'edition-1'), 'Production tournament missing');
const docs = {
  tournaments: snapshot.tournaments.map(({id, ...row}) => {
    const state = JSON.parse(row.body);
    assert.equal(state.revision, row.revision);
    assert.equal(state.matches.length, 48);
    return { _id: id, ...row };
  }),
  admins: snapshot.admins.map(({username, ...row}) => ({_id: username, ...row})),
  sessions: snapshot.sessions.map(({id, ...row}) => ({_id: id, ...row, expiresAt: new Date(row.expires)})),
};
const client = new MongoClient(process.env.MONGODB_URI, { maxPoolSize: 2, serverSelectionTimeoutMS: 10_000 });
try {
  const db = client.db(process.env.MONGODB_DB);
  await db.command({ ping: 1 });
  // Preflight every collection before any write. Refuse to overwrite existing data.
  for (const [name, rows] of Object.entries(docs)) {
    for (const row of rows) {
      const existing = await db.collection(name).findOne({ _id: row._id });
      if (existing) assert.deepEqual(existing, row, `${name} contains conflicting data`);
      else if (mode === '--verify' && !(name === 'sessions' && row.expires <= Date.now())) assert.fail(`${name} record missing`);
    }
    if (name !== 'sessions') assert.equal(await db.collection(name).countDocuments({ _id: { $nin: rows.map(r=>r._id) } }), 0, `Unexpected ${name} records`);
  }
  if (mode === '--apply') {
    for (const [name, rows] of Object.entries(docs)) {
      for (const row of rows) await db.collection(name).updateOne({ _id: row._id }, { $setOnInsert: row }, { upsert: true });
    }
    await db.collection('sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'sessions_expiry' });
  }
  console.log(`${mode === '--apply' ? 'Imported' : 'Verified'} ${docs.tournaments.length} tournaments, ${docs.admins.length} administrator bindings, ${docs.sessions.length} sessions. No record contents logged.`);
} catch (error) {
  console.error('Migration failed:', error.name, error.code ?? 'verification');
  process.exitCode = 1;
} finally { await client.close(); }
