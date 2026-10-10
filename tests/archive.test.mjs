import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

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

assert.deepEqual(archive.organizerNames, ['涵涵', '鵺']);
const page = readFileSync('app/hachicats/20260927/page.tsx', 'utf8');
assert(page.includes('archive.organizerNames.join'));
assert(!page.includes('<TournamentOrganizers'), 'Archive must not mount the live SSO lookup component');
console.log('PASS archived organizer names are static nicknames, without SSO/account dependency.');

// Exercise the real writer in a temporary directory with public API fixtures.
const dir = await mkdtemp(tmpdir() + '/tournament-archive-');
const originalFetch = globalThis.fetch, originalArgv = process.argv;
try {
  await mkdir(dir + '/scripts');
  await mkdir(dir + '/data/archive', { recursive: true });
  await copyFile('scripts/archive-tournament.mjs', dir + '/scripts/archive-tournament.mjs');
  process.argv = [process.execPath, dir + '/scripts/archive-tournament.mjs', 'https://archive.example', 'hachicats', '20260927'];
  let validNames = true;
  globalThis.fetch = async url => {
    const path = new URL(url).pathname;
    if (path.endsWith('/songs')) return Response.json({ catalog, pools, stale: false, incomplete: false });
    if (path.endsWith('/organizers')) return Response.json({ organizerNames: validNames ? archive.organizerNames : [null] });
    assert.equal(path, '/api/tournaments/hachicats/20260927');
    return Response.json({ tournament, demo: false });
  };
  const script = pathToFileURL(dir + '/scripts/archive-tournament.mjs').href;
  await import(script);
  assert.deepEqual(await readdir(dir + '/data/archive'), ['hachicats-20260927.json']);
  const file = dir + '/data/archive/hachicats-20260927.json';
  const contents = await readFile(file, 'utf8');
  const generated = JSON.parse(contents);
  assert.deepEqual(generated.organizerNames, ['涵涵', '鵺']);
  assert.deepEqual(generated.tournament, tournament);
  assert.deepEqual(generated.catalog, catalog);
  assert.deepEqual(generated.pools, pools);
  validNames = false;
  await assert.rejects(import(script + '?invalid-nicknames'), /Organizer nicknames are unavailable/);
  assert.equal(await readFile(file, 'utf8'), contents, 'Failed nickname lookup must not overwrite the archive');
  console.log('PASS archive writer combines nicknames and unchanged results in one file; invalid nicknames preserve the existing archive.');
} finally {
  globalThis.fetch = originalFetch;
  process.argv = originalArgv;
  await rm(dir, { recursive: true, force: true });
}
