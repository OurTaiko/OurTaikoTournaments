import { isDeepStrictEqual } from 'node:util';
import type { ClientSession, Db, Document, TransactionOptions } from 'mongodb';
import { MongoServerError } from 'mongodb';
import type { Database, TournamentRow, TournamentBackup } from './database';
import { splitTournament, joinTournament, validateStoredTournament, type TournamentDocument, type ParticipantDocument, type MatchDocument } from './tournament-documents';

export const transactionOptions: TransactionOptions = {
  readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' }, readPreference: 'primary', maxCommitTimeMS: 10000,
};
export async function withTournamentTransaction<T>(db: Db, action: (session: ClientSession) => Promise<T>): Promise<T> {
  const session = db.client.startSession();
  try { return await session.withTransaction(() => action(session), transactionOptions); }
  finally { await session.endSession(); }
}
type LegacyDocument = { _id: string; revision: number; body: string; schemaVersion?: 1; maintenance?: boolean };
export async function readTournamentDocuments(db: Db, id: string, session: ClientSession): Promise<TournamentRow | null> {
  const meta = await db.collection<TournamentDocument | LegacyDocument>('tournaments').findOne({ _id: id }, { session });
  if (!meta) return null;
  if (!('schemaVersion' in meta) || meta.schemaVersion === 1) {
    if (!('body' in meta) || typeof meta.body !== 'string') throw new Error('Invalid legacy tournament');
    return { id, revision: meta.revision, body: meta.body };
  }
  if (meta.schemaVersion !== 3 || 'body' in meta) throw new Error('Unsupported tournament schema');
  const participants = await db.collection<ParticipantDocument>('tournament_participants').find({ tournamentId: id }, { session }).toArray();
  const matches = await db.collection<MatchDocument>('matches').find({ tournamentId: id }, { session }).toArray();
  return joinTournament(meta, participants, matches);
}

function backupDocument({ id, body, ...row }: TournamentBackup) {
  const snapshot = validateStoredTournament(JSON.parse(body), row.revision);
  return { _id: id, ...row, schemaVersion: 3, snapshot };
}

// Changes are computed from a consistent read; a global revision CAS fences every commit.
// The API may calculate rules outside this transaction: stale revisions cannot commit.
export function mongoTournamentRepository(getDb: () => Promise<Db>): Pick<Database,
  'getTournament' | 'createTournament' | 'updateTournament' | 'saveTournamentBackup' | 'updateTournamentWithBackup'> {
  async function update(row: TournamentRow, previous: number, backup?: TournamentBackup) {
    if (!Number.isSafeInteger(previous) || previous < 0 || row.revision !== previous + 1)
      throw new Error('Tournament revisions must increase by one');
    const candidate = splitTournament(row);
    const db = await getDb();
    return withTournamentTransaction(db, async session => {
      const collection = db.collection<TournamentDocument | LegacyDocument>('tournaments');
      const meta = await collection.findOne({ _id: row.id }, { session });
      if (!meta || meta.revision !== previous) return false;
      if ((('format' in meta && meta.format) || undefined) !== candidate.tournament.format) throw new Error('Tournament format mismatch');
      if (meta.maintenance) throw new Error('Tournament maintenance in progress');
      const current = await readTournamentDocuments(db, row.id, session);
      if (!current) return false;
      if (backup) {
        if (backup.tournamentId !== row.id || backup.revision !== previous ||
            !isDeepStrictEqual(JSON.parse(backup.body), JSON.parse(current.body))) throw new Error('Backup does not match current tournament');
        await db.collection<Document & { _id: string }>('tournament_backups').insertOne(backupDocument(backup), { session });
      }
      if (meta.schemaVersion !== 3) {
        const result = await collection.updateOne({ _id: row.id, revision: previous, maintenance: { $ne: true } },
          { $set: { body: row.body, revision: row.revision } }, { session });
        if (result.matchedCount !== 1) throw new Error('Tournament commit conflict');
        return true;
      }
      const before = splitTournament(current);
      const result = await collection.updateOne({ _id: row.id, schemaVersion: 3, revision: previous, maintenance: { $ne: true } },
        { $set: { revision: row.revision, updatedAt: candidate.tournament.updatedAt,
          groups: candidate.tournament.groups, participantCount: candidate.participants.length, matchCount: candidate.matches.length,
          // Format-specific event state; a format can never change on update.
          ...(candidate.tournament.format ? { format: candidate.tournament.format, ranking: candidate.tournament.ranking } : {}) } }, { session });
      if (result.matchedCount !== 1) throw new Error('Tournament commit conflict');
      // bulkWrite is one ordered driver operation, never Promise.all inside a session.
      for (const [name, oldRows, newRows] of [
        ['tournament_participants', before.participants, candidate.participants],
        ['matches', before.matches, candidate.matches],
      ] as const) {
        const previousRows = new Map<string, Document>(oldRows.map(r => [r._id, r]));
        const operations = newRows.filter(r => !isDeepStrictEqual(previousRows.get(r._id), r))
          .map(document => ({ replaceOne: { filter: { _id: document._id, tournamentId: row.id }, replacement: document, upsert: true } }));
        const target = db.collection<Document & { _id: string }>(name);
        if (operations.length) await target.bulkWrite(operations, { session, ordered: true });
        const nextIds = new Set(newRows.map(r => r._id));
        const removed = oldRows.filter(r => !nextIds.has(r._id)).map(r => r._id);
        if (removed.length) await target.deleteMany({ tournamentId: row.id, _id: { $in: removed } }, { session });
      }
      return true;
    });
  }
  return {
    async getTournament(id) { const db = await getDb(); return withTournamentTransaction(db, s => readTournamentDocuments(db, id, s)); },
    async createTournament(row) {
      const candidate = splitTournament(row);
      const db = await getDb();
      try { await withTournamentTransaction(db, async session => {
        const tournaments = db.collection<TournamentDocument>('tournaments');
        if (await tournaments.findOne({ _id: row.id }, { session })) return;
        for (const name of ['matches', 'tournament_participants'])
          if (await db.collection(name).findOne({ tournamentId: row.id }, { session })) throw new Error('Orphaned tournament documents');
        await tournaments.insertOne(candidate.tournament, { session });
        if (candidate.participants.length) await db.collection<ParticipantDocument>('tournament_participants').insertMany(candidate.participants, { session });
        if (candidate.matches.length) await db.collection<MatchDocument>('matches').insertMany(candidate.matches, { session });
      }); } catch (error) {
        if (!(error instanceof MongoServerError && error.code === 11000) || !await db.collection<TournamentDocument>('tournaments').findOne({ _id: row.id })) throw error;
      }
    },
    updateTournament: (row, previous) => update(row, previous),
    updateTournamentWithBackup: (row, previous, backup) => update(row, previous, backup),
    async saveTournamentBackup(row) { await (await getDb()).collection<Document & { _id: string }>('tournament_backups').insertOne(backupDocument(row)); },
  };
}
