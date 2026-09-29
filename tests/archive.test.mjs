import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Static archives must hold only what the public API already published.
const archive = JSON.parse(readFileSync('data/archive/hachicats-20260927.json', 'utf8'));
const { tournament, catalog, pools } = archive;
assert.equal(archive.id, 'hachicats-20260927');
assert.equal(tournament.matches.length, 48);
const played = new Set();
for (const m of tournament.matches) {
  assert.ok(m.published && ['complete', 'bye'].includes(m.status), `${m.id} is not a published final result`);
  assert.ok(m.winner && (m.winner === m.a?.id || m.winner === m.b?.id), `${m.id} winner is not a participant`);
  for (const s of m.scores) { assert.ok(catalog[s.songId], `${m.id} references unknown song ${s.songId}`); played.add(s.songId); }
  for (const id of [...m.picks.flat(), ...m.bans.filter(Boolean)]) assert.ok(catalog[id], `${m.id} references unknown pick ${id}`);
}
for (const id of Object.keys(catalog).filter(id => id.startsWith('special:')))
  assert.ok(played.has(id), `designated song ${id} was never played publicly`);
for (const [group, ids] of Object.entries(pools)) {
  assert.equal(ids.length, 12, `${group} pool size`);
  for (const id of ids) assert.ok(catalog[id]?.title, `${id} lacks a title`);
}
console.log('PASS HachiCats archive holds only published final results and designated songs that were played.');
