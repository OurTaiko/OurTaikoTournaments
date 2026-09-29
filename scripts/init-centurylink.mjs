import assert from 'node:assert/strict';
import { readFile, mkdtemp, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { MongoClient } from 'mongodb';

// Explicit production provisioning for CenturyLink 2026-12-27: an empty event (no players yet)
// and the private song library. Never overwrites; re-running only verifies.
const [file, mode] = process.argv.slice(2);
assert(file && ['--apply', '--verify'].includes(mode), 'Usage: node --env-file=<private env> scripts/init-centurylink.mjs <private library.json> --apply|--verify');
assert(process.env.MONGODB_URI && process.env.MONGODB_DB, 'MongoDB configuration required');
const id = 'centurylink-20261227';
await mkdir('.data', { recursive: true });
const dir = await mkdtemp(resolve('.data/centurylink-init-'));
const client = new MongoClient(process.env.MONGODB_URI, { maxPoolSize: 2, serverSelectionTimeoutMS: 10000 });
try {
  await build({ stdin: { contents: `
    export { parseCenturyLinkSongLibrary } from './lib/centurylink-song-library';
    export { makeCenturyLink } from './lib/centurylink';
    export { mongoTournamentRepository } from './lib/mongo-tournaments';
    export { validateCenturyLink } from './lib/tournament-documents';
  `, resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'cjs', external: ['mongodb'], outfile: dir + '/init.cjs' });
  const lib = (await import(dir + '/init.cjs')).default;
  const library = lib.parseCenturyLinkSongLibrary(JSON.parse(await readFile(file, 'utf8')));
  assert.equal(library.id, id, 'This tool only provisions centurylink-20261227');
  const db = client.db(process.env.MONGODB_DB);
  // `_id` first, matching how MongoDB returns the stored document.
  const expected = Object.fromEntries([['_id', id], ...Object.entries(library).filter(([key]) => key !== 'id')]);
  const libraries = db.collection('song_libraries');
  const existing = await libraries.findOne({ _id: id });
  if (existing && JSON.stringify(existing) !== JSON.stringify(expected)) throw Error('Existing library differs; refusing to overwrite');
  const repository = lib.mongoTournamentRepository(async () => db);
  if (mode === '--apply') {
    if (!existing) await libraries.insertOne(expected);
    // createTournament is create-if-absent inside a transaction; an existing event is left untouched.
    await repository.createTournament({ id, revision: 0, body: JSON.stringify(lib.makeCenturyLink()) });
  }
  const stored = await libraries.findOne({ _id: id });
  // Avoid printing either document if verification fails.
  if (!stored || JSON.stringify(stored) !== JSON.stringify(expected)) throw Error('Library verification failed');
  const row = await repository.getTournament(id);
  if (!row) throw Error('Tournament has not been created');
  const state = lib.validateCenturyLink(JSON.parse(row.body), row.revision);
  console.log(`Verified ${id}: 32 pool charts, 6 designated charts; tournament revision ${state.revision}, ${state.players.length} players, ${state.matches.length} matches.`);
} finally {
  await client.close();
  await rm(dir, { recursive: true, force: true });
}
