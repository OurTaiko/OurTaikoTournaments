import assert from 'node:assert/strict';
import { migrateTournamentId, oldId, newId } from '../scripts/migrate-tournament-id.mjs';
const original = {
  tournaments: [{ _id: oldId, revision: 42, body: ' {"revision":42,"scores":[123],"id":"stable-match"} ' }, { _id: 'other', body: 'unchanged' }],
  song_libraries: [{ _id: oldId, version: 1, pools: { synthetic: ['stable-song'] }, designated: { synthetic: 'test-only' } }],
  tournament_backups: [{ _id: 'backup', tournamentId: oldId, revision: 41, body: 'original bytes' }],
  tournament_id_migrations: [],
};
function fixture(initial = original, fail = false) {
  let state = structuredClone(initial);
  const db = { collection(name) {
    const matches = (row, query) => Object.entries(query).every(([key, value]) => row[key] === value);
    return {
      findOne: async query => state[name].find(row => matches(row, query)),
      find: query => ({ toArray: async () => state[name].filter(row => matches(row, query)) }),
      insertOne: async row => { if (state[name].some(item => item._id === row._id)) throw Error('duplicate'); state[name].push(structuredClone(row)); },
      deleteOne: async query => { const before = state[name].length; state[name] = state[name].filter(row => !matches(row, query)); return { deletedCount: before - state[name].length }; },
      updateMany: async (query, update) => { if (fail) throw Error('injected failure'); state[name].forEach(row => { if (matches(row, query)) Object.assign(row, update.$set); }); },
    };
  } };
  return { state: () => state, async run(apply) {
    const snapshot = structuredClone(state);
    try { return await migrateTournamentId(db, {}, apply); }
    catch (error) { state = snapshot; throw error; }
  } };
}
const f = fixture();
await assert.rejects(f.run(false));
assert.deepEqual(f.state(), original);
await f.run(true);
assert.deepEqual(f.state().tournaments.find(row => row._id === newId), { ...original.tournaments[0], _id: newId });
assert.deepEqual(f.state().song_libraries[0], { ...original.song_libraries[0], _id: newId });
assert.deepEqual(f.state().tournament_backups[0], { ...original.tournament_backups[0], tournamentId: newId });
assert.deepEqual(f.state().tournament_id_migrations[0].tournament, original.tournaments[0]);
assert.deepEqual(f.state().tournament_id_migrations[0].songLibrary, original.song_libraries[0]);
const after = structuredClone(f.state());
await f.run(true);
await f.run(false);
assert.deepEqual(f.state(), after);
for (const data of [
  { ...original, tournaments: [...original.tournaments, { _id: newId }] },
  { ...original, song_libraries: [] },
]) {
  const conflict = fixture(data);
  await assert.rejects(conflict.run(true));
  assert.deepEqual(conflict.state(), data);
}
const failure = fixture(original, true);
await assert.rejects(failure.run(true));
assert.deepEqual(failure.state(), original);
console.log('PASS ID migration preserves payloads, archives originals, rejects conflicts, is idempotent; simulated transaction rollback.');
