import assert from 'node:assert/strict';
import { readFile, mkdtemp, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { MongoClient } from 'mongodb';

const [file, mode] = process.argv.slice(2);
assert(file && ['--apply', '--verify'].includes(mode), 'Usage: node --env-file=<private env> scripts/import-song-library.mjs <private library.json> --apply|--verify');
assert(process.env.MONGODB_URI && process.env.MONGODB_DB, 'MongoDB configuration required');
await mkdir('.data', { recursive: true });
const dir = await mkdtemp(resolve('.data/song-import-'));
const client = new MongoClient(process.env.MONGODB_URI, { maxPoolSize: 2, serverSelectionTimeoutMS: 10000 });
try {
  await build({ entryPoints: ['lib/song-library.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: dir + '/schema.cjs' });
  const { parseSongLibrary } = (await import(dir + '/schema.cjs')).default;
  const library = parseSongLibrary(JSON.parse(await readFile(file, 'utf8')));
  assert.equal(library.id, 'hachicats-20260927', 'This importer only provisions the first tournament');
  const { id, ...fields } = library;
  const expected = { _id: id, ...fields };
  const collection = client.db(process.env.MONGODB_DB).collection('song_libraries');
  const existing = await collection.findOne({ _id: id });
  if (existing && JSON.stringify(existing) !== JSON.stringify(expected)) throw Error('Existing library differs; refusing to overwrite');
  if (!existing && mode === '--apply') await collection.insertOne(expected);
  const stored = await collection.findOne({ _id: id });
  // Avoid printing either document if verification fails.
  if (!stored || JSON.stringify(stored) !== JSON.stringify(expected)) throw Error('Library verification failed');
  console.log('Verified hachicats-20260927: 36 regular charts and 6 designated charts. No existing tournament state was changed.');
} finally {
  await client.close();
  await rm(dir, { recursive: true, force: true });
}
