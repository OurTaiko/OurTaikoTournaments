import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
const dir = await mkdtemp(tmpdir() + '/tournament-documents-');
try {
  await build({ stdin: { contents: `export * from './lib/tournament-documents'; export * from './lib/tournament-seed'; export * from './lib/tournament';`, resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'cjs', outfile: dir + '/test.cjs' });
  const api = (await import(dir + '/test.cjs')).default;
  const state = api.tournamentState(api.makeTournament(true));
  state.revision = 168;
  state.matches[0].scores = [{ songId: 'synthetic-chart', a: 0, b: null }];
  state.matches.find(m => m.round === 3).scores = [{ songId: 'special:synthetic-legacy-id', a: 10, b: 20 }];
  const row = { id: 'hachicats-20260927', revision: 168, body: JSON.stringify(state, null, 2) };
  const parts = api.splitTournament(row);
  assert.equal('body' in parts.tournament, false);
  assert.equal(parts.matches.length, 48);
  assert.equal(parts.participants.length, 48);
  assert.deepEqual(JSON.parse(api.joinTournament(parts.tournament, parts.participants.toReversed(), parts.matches.toReversed()).body), state);
  assert.equal(parts.matches[0].revision, undefined);
  assert.notEqual(api.documentKey('a-b', 'c'), api.documentKey('a', 'b-c'));
  const other = api.splitTournament({ ...row, id: 'other-20260927' });
  assert.notEqual(parts.matches[0]._id, other.matches[0]._id);
  for (const mutate of [
    s => { s.revision++; }, s => { s.matches[0].a.id = 'missing'; },
    s => { s.rosters.tabby[0].id = s.rosters.siamese[0].id; },
    s => { s.matches[1].id = s.matches[0].id; }, s => { s.unknown = 'cannot silently drop'; },
  ]) { const broken = structuredClone(state); mutate(broken); assert.throws(() => api.splitTournament({ ...row, body: JSON.stringify(broken) })); }
  assert.throws(() => api.joinTournament(parts.tournament, parts.participants.slice(1), parts.matches));
  const contaminated = structuredClone(parts.matches); contaminated[0].tournamentId = 'other';
  assert.throws(() => api.joinTournament(parts.tournament, parts.participants, contaminated));
  console.log('PASS native documents preserve IDs, order, null/zero scores, legacy song references and missing revisions; malformed references fail closed.');
} finally { await rm(dir, { recursive: true, force: true }); }
