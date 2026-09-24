import { MongoClient, MongoServerError, type Db } from 'mongodb';
import type { AdminBinding, Database, SessionRow, TournamentRow } from './database';

type TournamentDocument = Omit<TournamentRow, 'id'> & { _id: string };
type SessionDocument = Omit<SessionRow, 'id'> & { _id: string; expiresAt: Date };
type AdminDocument = Omit<AdminBinding, 'username'> & { _id: string };

// Reuse one bounded connection pool per warm serverless instance.
let connection: Promise<MongoClient> | undefined;
export async function mongoConnection() {
  if (!connection) {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI is required');
    const client = new MongoClient(uri, {
      maxPoolSize: 5, minPoolSize: 0, maxIdleTimeMS: 60_000,
      serverSelectionTimeoutMS: 8_000, connectTimeoutMS: 8_000,
      retryWrites: true,
    });
    connection = client.connect().catch(async (error) => {
      connection = undefined;
      await client.close();
      throw error;
    });
  }
  return connection;
}

export function mongoDatabase(getDb: () => Promise<Db>): Database {
  const tournaments = async () => (await getDb()).collection<TournamentDocument>('tournaments');
  const sessions = async () => (await getDb()).collection<SessionDocument>('sessions');
  const admins = async () => (await getDb()).collection<AdminDocument>('admins');
  return {
    async ping() { await (await getDb()).command({ ping: 1 }); },
    async getTournament(id) {
      const row = await (await tournaments()).findOne({ _id: id });
      return row ? { id: row._id, revision: row.revision, body: row.body } : null;
    },
    async createTournament(row) {
      // A duplicate _id means another instance initialized the same tournament.
      try { await (await tournaments()).insertOne({ _id: row.id, revision: row.revision, body: row.body }); }
      catch (error) { if (!(error instanceof MongoServerError && error.code === 11000)) throw error; }
    },
    async updateTournament(row, previous) {
      const result = await (await tournaments()).updateOne(
        { _id: row.id, revision: previous },
        { $set: { body: row.body, revision: row.revision } },
      );
      return result.matchedCount === 1;
    },
    async saveSession(row) {
      await (await sessions()).insertOne({ _id: row.id, body: row.body, expires: row.expires, expiresAt: new Date(row.expires) });
    },
    async getSession(id, now) {
      // TTL cleanup is asynchronous: enforce expiry on every read as well.
      const row = await (await sessions()).findOne({ _id: id, expires: { $gt: now } });
      return row ? { id: row._id, body: row.body, expires: row.expires } : null;
    },
    async deleteSession(id) {
      return (await (await sessions()).deleteOne({ _id: id })).deletedCount === 1;
    },
    async bindAdmin(binding) {
      try { await (await admins()).insertOne({ _id: binding.username, subject: binding.subject, issuer: binding.issuer }); }
      catch (error) { if (!(error instanceof MongoServerError && error.code === 11000)) throw error; }
    },
    async hasAdmin(names, issuer, subject) {
      if (!names.length) return false;
      return !!await (await admins()).findOne({ _id: { $in: names }, issuer, subject }, { projection: { _id: 1 } });
    },
  };
}

export const database = mongoDatabase(async () => {
  const name = process.env.MONGODB_DB;
  if (!name) throw new Error('MONGODB_DB is required');
  return (await mongoConnection()).db(name);
});
