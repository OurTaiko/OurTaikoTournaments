// Configure live-event organizers/admins on the existing tournaments document.
// Default is read-only. --apply requires the observed revision. Never creates/resets an event.
// An atomic private metadata backup is stored in tournament_people_backups before the CAS write.
// Usage: node --env-file=<private env> scripts/set-tournament-people.mjs <event-id> <private people.json> [--apply --revision N]
import assert from 'node:assert/strict';
import { readFile, mkdtemp, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { build } from 'esbuild';
import { MongoClient } from 'mongodb';

const [id, file, ...flags] = process.argv.slice(2);
const apply = flags[0] === '--apply';
assert(id && file && (flags.length === 0 || (flags.length === 3 && apply && flags[1] === '--revision')), 'Usage: <event-id> <private people.json> [--apply --revision N]');
assert(process.env.MONGODB_URI && process.env.MONGODB_DB, 'MongoDB configuration required');
await mkdir('.data', { recursive: true });
const dir = await mkdtemp(resolve('.data/tournament-people-'));
const client = new MongoClient(process.env.MONGODB_URI, { maxPoolSize: 2, serverSelectionTimeoutMS: 10000 });
try {
  await build({ stdin: { contents: `
    export { tournaments } from './lib/tournaments';
    export { parseTournamentPeople, tournamentPeopleFromDocument } from './lib/tournament-people';
    export { updateTournamentPeople } from './lib/mongo-tournaments';
  `, resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'cjs', external: ['mongodb'], outfile: dir + '/people.cjs' });
  const lib = (await import(dir + '/people.cjs')).default;
  assert(lib.tournaments.some(event => event.id === id && !event.archived), 'Only registered live events can be configured');
  const people = lib.parseTournamentPeople(JSON.parse(await readFile(file, 'utf8')));
  const db = client.db(process.env.MONGODB_DB);
  const meta = await db.collection('tournaments').findOne({ _id: id });
  assert(meta?.schemaVersion === 3 && !meta.maintenance, 'Existing native tournament required');
  if (!apply) console.log(`Dry run: ${id}, revision ${meta.revision}; ${people.organizers.length} organizers, ${people.admins.length} admins. No writes.`);
  else {
    const previous = Number(flags[2]);
    assert(Number.isSafeInteger(previous) && previous === meta.revision, 'Revision changed; inspect and retry');
    const changed = !isDeepStrictEqual(lib.tournamentPeopleFromDocument(meta), people);
    assert(await lib.updateTournamentPeople(db, id, previous, people), 'Revision conflict; no changes committed');
    console.log(`Applied ${id}: revision ${previous + Number(changed)}; ${changed ? 'metadata backed up atomically' : 'already configured, no writes'}.`);
  }
} finally {
  await client.close();
  await rm(dir, { recursive: true, force: true });
}
