import type { Db } from 'mongodb';

// Old writers may read a migrated document but must never reintroduce a body string.
const nativeTournament = { $and: [
  { schemaVersion: 3, body: { $exists: false }, rosters: { $exists: false }, matches: { $exists: false } },
  { $jsonSchema: { bsonType: 'object', required: ['_id', 'revision', 'updatedAt', 'groups', 'participantCount', 'matchCount'], properties: {
    _id: { bsonType: 'string' }, revision: { bsonType: ['int', 'long', 'double'], minimum: 0 },
    updatedAt: { bsonType: 'string' }, groups: { bsonType: 'array', items: { bsonType: 'string' } },
    participantCount: { bsonType: ['int', 'long', 'double'], minimum: 0 }, matchCount: { bsonType: ['int', 'long', 'double'], minimum: 0 },
  } } },
] };
export async function ensureTournamentSchema(db: Db) {
  const validator = { $or: [
    { $and: [{ $or: [{ schemaVersion: { $exists: false } }, { schemaVersion: 1 }] }, { body: { $type: 'string' } }] },
    nativeTournament,
  ] };
  const exists = await db.listCollections({ name: 'tournaments' }, { nameOnly: true }).hasNext();
  if (exists) await db.command({ collMod: 'tournaments', validator, validationLevel: 'strict', validationAction: 'error' });
  else await db.createCollection('tournaments', { validator });
  for (const [name, idField] of [['tournament_participants', 'playerId'], ['matches', 'matchId']] as const) {
    const collectionValidator = { $jsonSchema: { bsonType: 'object', required: ['_id', 'tournamentId', idField], properties: {
      _id: { bsonType: 'string' }, tournamentId: { bsonType: 'string' }, [idField]: { bsonType: 'string' },
    } } };
    if (!await db.listCollections({ name }, { nameOnly: true }).hasNext()) await db.createCollection(name, { validator: collectionValidator });
    else await db.command({ collMod: name, validator: collectionValidator, validationLevel: 'strict', validationAction: 'error' });
    await db.collection(name).createIndex({ tournamentId: 1, [idField]: 1 }, { unique: true });
  }
  await db.collection('tournament_participants').createIndex({ tournamentId: 1, groupId: 1, rosterOrder: 1 }, { unique: true });
  await db.collection('matches').createIndex({ tournamentId: 1, group: 1, round: 1, index: 1 }, { unique: true });
  await db.collection('tournament_backups').createIndex({ tournamentId: 1, createdAt: -1 });
  await db.collection('tournament_schema_migrations').createIndex({ tournamentId: 1, toVersion: 1 }, { unique: true });
}
