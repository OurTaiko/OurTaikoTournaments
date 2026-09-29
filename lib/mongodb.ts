import { MongoClient, MongoServerError, type Db } from 'mongodb';
import { mongoTournamentRepository } from './mongo-tournaments';
import type { Database, SessionRow } from './database';
import type { SongLibrary } from './song-library';

type SessionDocument = Omit<SessionRow, 'id'> & { _id: string; expiresAt: Date };

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
  const sessions = async () => (await getDb()).collection<SessionDocument>('sessions');
  return {
    ...mongoTournamentRepository(getDb),
    async getSongLibrary(id) {
      const row = await (await getDb()).collection<Omit<SongLibrary, 'id'> & { _id: string }>('song_libraries').findOne({ _id: id });
      if (!row) return null;
      return { id: row._id, version: row.version, pools: row.pools, designated: row.designated };
    },
    async createSongLibrary({ id, ...library }) {
      try { await (await getDb()).collection<Omit<SongLibrary, 'id'> & { _id: string }>('song_libraries').insertOne({ _id: id, ...library }); }
      catch (error) { if (!(error instanceof MongoServerError && error.code === 11000)) throw error; }
    },
    async ping() { await (await getDb()).command({ ping: 1 }); },
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

  };
}

export const database = mongoDatabase(async () => {
  const name = process.env.MONGODB_DB;
  if (!name) throw new Error('MONGODB_DB is required');
  return (await mongoConnection()).db(name);
});
