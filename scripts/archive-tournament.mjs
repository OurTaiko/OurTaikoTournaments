// Freeze a finished tournament from its public API into a static archive.
// Only public responses are read, so unpublished picks or private libraries cannot leak.
// Usage: node scripts/archive-tournament.mjs <origin> <series> <edition>
import { writeFileSync } from 'node:fs';

const [origin, series, edition] = process.argv.slice(2);
if (!origin || !series || !edition) throw new Error('Usage: node scripts/archive-tournament.mjs <origin> <series> <edition>');
const base = new URL(`/api/tournaments/${series}/${edition}`, origin).href;
const get = async path => {
  const response = await fetch(base + path, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${base + path}: HTTP ${response.status}`);
  return response.json();
};
const [{ tournament, demo }, { catalog, pools, stale, incomplete }] = await Promise.all([get(''), get('/songs')]);
if (demo) throw new Error('Refusing to archive demo data');
if (stale || incomplete) throw new Error('Song metadata is stale or incomplete; retry later');
const open = tournament.matches.filter(m => !m.published || !['complete', 'bye'].includes(m.status));
if (open.length) throw new Error(`Tournament is not finished: ${open.map(m => m.id).join(', ')}`);

const id = `${series}-${edition}`;
const file = new URL(`../data/archive/${id}.json`, import.meta.url);
writeFileSync(file, JSON.stringify({ id, archivedAt: new Date().toISOString(), source: base, tournament, catalog, pools }, null, 2) + '\n');
console.log(`Archived ${id} at revision ${tournament.revision}: ${tournament.matches.length} matches, ${Object.keys(catalog).length} songs.`);
