import { MongoClient } from 'mongodb';
import { pathToFileURL } from 'node:url';

export const oldId = 'edition-1';
export const newId = 'hachicats-20260927';

// Called inside one MongoDB transaction; never parse or rewrite private payloads.
export async function migrateTournamentId(db, session, apply) {
  const options = { session };
  const collections = ['tournaments', 'song_libraries'];
  // MongoDB session transactions require sequential operations.
  const sources = [];
  const targets = [];
  for (const name of collections) {
    sources.push(await db.collection(name).findOne({ _id: oldId }, options));
    targets.push(await db.collection(name).findOne({ _id: newId }, options));
  }
  const backups = await db.collection('tournament_backups').find({ tournamentId: oldId }, options).toArray();
  if (sources.every(row => !row) && targets.every(Boolean) && !backups.length)
    return { migrated: false, verified: true };
  if (!sources.every(Boolean) || targets.some(Boolean)) throw new Error('Missing source or conflicting destination; no changes applied');
  if (!apply) throw new Error('Legacy tournament requires migration');
  // Archive exact source documents and affected backup IDs before changing keys.
  await db.collection('tournament_id_migrations').insertOne({
    _id: `${oldId}:${newId}`, oldId, newId, createdAt: new Date(),
    tournament: sources[0], songLibrary: sources[1], backupIds: backups.map(row => row._id),
  }, options);
  for (let index = 0; index < collections.length; index++) {
    const collection = db.collection(collections[index]);
    await collection.insertOne({ ...sources[index], _id: newId }, options);
    const result = await collection.deleteOne({ _id: oldId }, options);
    if (result.deletedCount !== 1) throw new Error('Source changed during migration');
  }
  await db.collection('tournament_backups').updateMany({ tournamentId: oldId }, { $set: { tournamentId: newId } }, options);
  return { migrated: true, verified: true };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const mode = process.argv[2];
  if (!['--apply', '--verify'].includes(mode) || !process.env.MONGODB_URI || process.env.MONGODB_DB !== 'tournaments')
    throw new Error('Requires MONGODB_URI, MONGODB_DB=tournaments and --apply|--verify');
  const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  const session = client.startSession();
  try {
    const result = await session.withTransaction(() => migrateTournamentId(client.db('tournaments'), session, mode === '--apply'), {
      readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' },
    });
    console.log(JSON.stringify({ tournament: newId, ...result }));
  } catch {
    console.error('Tournament ID migration failed. No partial transaction was committed; inspect configuration and source/destination keys privately.');
    process.exitCode = 1;
  } finally {
    await session.endSession();
    await client.close();
  }
}
