import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import type { Db, Document } from 'mongodb';
import { splitTournament, joinTournament, type MatchDocument, type ParticipantDocument } from './tournament-documents';
import { readTournamentDocuments, withTournamentTransaction } from './mongo-tournaments';
export const bodyHash = (body: string) => createHash('sha256').update(body).digest('hex');

export async function migrateTournamentSchema(db: Db, id: string, expectedRevision: number, expectedHash: string) {
  return withTournamentTransaction(db, async session => {
    const tournaments = db.collection<Document & { _id: string }>('tournaments');
    const source = await tournaments.findOne({ _id: id }, { session });
    if (!source) throw new Error('Tournament missing');
    if (source.schemaVersion === 3) {
      const current = await readTournamentDocuments(db, id, session);
      if (!current) throw new Error('Tournament missing');
      return { migrated: false, revision: current.revision };
    }
    if ((source.schemaVersion !== undefined && source.schemaVersion !== 1) || typeof source.body !== 'string' ||
        source.revision !== expectedRevision || bodyHash(source.body) !== expectedHash) throw new Error('Source changed; new backup required');
    if (Object.keys(source).some(k => !['_id', 'body', 'revision', 'schemaVersion', 'maintenance'].includes(k)))
      throw new Error('Unexpected legacy metadata; inspect before migration');
    for (const name of ['matches', 'tournament_participants'])
      if (await db.collection(name).findOne({ tournamentId: id }, { session })) throw new Error('Destination contains conflicting records');
    const parts = splitTournament({ id, revision: source.revision, body: source.body });
    if (!isDeepStrictEqual(JSON.parse(joinTournament(parts.tournament, parts.participants, parts.matches).body), JSON.parse(source.body)))
      throw new Error('Round-trip mismatch');
    // Original bytes are archived, not normalized by hydration or a new roster seed.
    await db.collection<Document & { _id: string }>('tournament_schema_migrations').insertOne({
      _id: JSON.stringify([id, 3]), tournamentId: id, fromVersion: 1, toVersion: 3,
      sourceRevision: source.revision, sourceHash: expectedHash, source, createdAt: new Date(),
    }, { session });
    if (parts.participants.length) await db.collection<ParticipantDocument>('tournament_participants').insertMany(parts.participants, { session });
    if (parts.matches.length) await db.collection<MatchDocument>('matches').insertMany(parts.matches, { session });
    const result = await tournaments.replaceOne({ _id: id, revision: expectedRevision, body: source.body },
      { ...parts.tournament, ...(source.maintenance ? { maintenance: true } : {}) }, { session });
    if (result.matchedCount !== 1) throw new Error('Source changed; migration aborted');
    const saved = await readTournamentDocuments(db, id, session);
    if (!saved || saved.revision !== expectedRevision || !isDeepStrictEqual(JSON.parse(saved.body), JSON.parse(source.body)))
      throw new Error('Migration verification failed');
    return { migrated: true, revision: saved.revision, participants: parts.participants.length, matches: parts.matches.length };
  });
}
