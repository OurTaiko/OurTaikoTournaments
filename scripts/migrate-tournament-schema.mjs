import { MongoClient, BSON } from 'mongodb';
import { build } from 'esbuild';
import { mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';

const [mode, id] = process.argv.slice(2);
if (!['--apply', '--verify', '--dry-run'].includes(mode) || !id || !process.env.MONGODB_URI || !process.env.MONGODB_DB)
  throw new Error('Usage: node --env-file=<private env> scripts/migrate-tournament-schema.mjs --dry-run|--apply|--verify <tournament-id>');
const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
await mkdir('.data/migration', { recursive: true, mode: 0o700 });
const dir = await mkdtemp(resolve('.data/migration/schema-tools-'));
try {
  await build({ stdin: { contents: `export * from './lib/migrate-tournament-schema'; export * from './lib/mongo-tournaments'; export * from './lib/mongo-schema'; export * from './lib/tournament-documents';`, resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'cjs', external: ['mongodb'], outfile: dir + '/tools.cjs' });
  const api = (await import(pathToFileURL(dir + '/tools.cjs').href)).default;
  const db = client.db(process.env.MONGODB_DB);
  const source = await db.collection('tournaments').findOne({ _id: id });
  if (!source) throw Error('Tournament missing');
  if (mode === '--verify' || source.schemaVersion === 3) {
    if (source.schemaVersion !== 3) throw Error('Migration required');
    const row = await api.withTournamentTransaction(db, session => api.readTournamentDocuments(db, id, session));
    console.log(JSON.stringify({ verified: !!row, id, schemaVersion: 3, revision: row.revision }));
  } else {
    const parts = api.splitTournament({ id, revision: source.revision, body: source.body });
    const summary = { id, revision: source.revision, participants: parts.participants.length, matches: parts.matches.length };
    if (mode === '--dry-run') console.log(JSON.stringify({ ...summary, dryRun: true }));
    else {
      // A full database snapshot (including private libraries and indexes) precedes every apply.
      const names = await db.listCollections({}).toArray();
      const snapshot = await api.withTournamentTransaction(db, async session => {
        const collections = {};
        for (const { name } of names) collections[name] = await db.collection(name).find({}, { session }).toArray();
        return { database: db.databaseName, createdAt: new Date(), collectionOptions: names, collections };
      });
      snapshot.indexes = {};
      for (const { name } of names) snapshot.indexes[name] = await db.collection(name).listIndexes().toArray();
      const backedUp = snapshot.collections.tournaments.find(row => row._id === id);
      if (!backedUp || backedUp.revision !== source.revision || backedUp.body !== source.body) throw Error('Source changed during backup');
      const backupPath = `.data/migration/atlas-schema3-${randomUUID()}.ejson`;
      await writeFile(backupPath, BSON.EJSON.stringify(snapshot, { relaxed: false }), { mode: 0o600, flag: 'wx' });
      await api.ensureTournamentSchema(db);
      const result = await api.migrateTournamentSchema(db, id, source.revision, api.bodyHash(source.body));
      console.log(JSON.stringify({ ...summary, ...result, backupPath }));
    }
  }
} catch (error) {
  console.error(JSON.stringify({ status: 'migration-failed-inspect-before-retry', error: error.name, code: error.code ?? null }));
  process.exitCode = 1;
} finally {
  await client.close();
  await rm(dir, { recursive: true, force: true });
}
