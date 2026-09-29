import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { MongoClient } from 'mongodb';

const mode = process.argv[2];
if (!['--apply', '--verify'].includes(mode)) throw Error('Usage: node --env-file=<private env> scripts/migrate-players.mjs --apply|--verify');
if (!process.env.MONGODB_URI || process.env.MONGODB_DB !== 'tournaments') throw Error('Expected OurTaiko Atlas database tournaments configuration');
const dir = await mkdtemp(tmpdir() + '/hachicats-roster-migration-');
const client = new MongoClient(process.env.MONGODB_URI, { maxPoolSize: 2, serverSelectionTimeoutMS: 10000 });
try {
  await build({ stdin: { contents: "export {migratePlayers} from './lib/migrate-players'; export {mongoDatabase} from './lib/mongodb';", resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'cjs', outfile: dir + '/migration.cjs' });
  const { migratePlayers, mongoDatabase } = (await import(pathToFileURL(dir + '/migration.cjs').href)).default;
  const result = await migratePlayers(mongoDatabase(async () => client.db(process.env.MONGODB_DB)), mode === '--apply');
  console.log(JSON.stringify({ tournament: 'hachicats-20260927', ...result }));
} catch (error) {
  // Driver errors may contain connection details; keep credentials out of logs.
  console.error('Player migration failed:', error?.name ?? 'Error');
  process.exitCode = 1;
} finally { await client.close(); await rm(dir, { recursive: true, force: true }); }
