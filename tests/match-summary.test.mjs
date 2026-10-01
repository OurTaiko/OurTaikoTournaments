import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';

const dir = await mkdtemp(tmpdir() + '/hachicats-match-summary-');
try {
  await build({
    stdin: { contents: `
      import { createElement } from 'react';
      import { renderToStaticMarkup } from 'react-dom/server';
      import MatchSummary from './components/match-summary';
      import MatchEditor from './components/match-editor';
      export { makeTournament } from './lib/tournament-seed';
      export const viewer = props => renderToStaticMarkup(createElement(MatchSummary, props));
      export const admin = props => renderToStaticMarkup(createElement(MatchEditor, props));
    `, resolveDir: process.cwd() },
    bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', outfile: dir + '/summary.cjs',
  });
  const { viewer, admin, makeTournament } = (await import(dir + '/summary.cjs')).default;
  const tournament = makeTournament();
  const match = tournament.matches.find(m => m.id === 'siamese-r3-0');
  Object.assign(match, {
    a: tournament.rosters.siamese[0], b: tournament.rosters.siamese[1],
    status: 'complete', published: true, winner: tournament.rosters.siamese[0].id,
    picks: [['siamese-1', 'siamese-2'], ['siamese-2', 'siamese-3']], bans: ['siamese-2', 'siamese-1'],
    scores: [{ songId: 'siamese-2', a: 950000, b: 940000 }, { songId: 'siamese-3', a: 980000, b: 990000 }, { songId: 'special:siamese:final', a: 1000000, b: 960000 }],
  });
  const catalog = Object.fromEntries(['siamese-1', 'siamese-2', 'siamese-3', 'special:siamese:final'].map((id, i) => [id, { id, songID: i + 1, difficultyIndex: 4, stars: 8, title: `Sample ${i + 1}` }]));
  const props = { match, catalog, tournament, revision: 0, designated: catalog['special:siamese:final'], pool: [], onSaved() {}, onReplace: async () => false };
  for (const render of [viewer, admin]) {
    const html = render(props);
    assert.equal((html.match(/<tbody>(.*?)<\/tbody>/s)[1].match(/<tr>/g) ?? []).length, 3);
    assert(html.includes('1,000,000') && html.includes('2,930,000'));
    assert(html.includes('获得冠军') && html.includes('指定曲'));
    // Each player's record is an <h4> name followed by their picks; match structure, not styling.
    const records = [...html.matchAll(/<h4[^>]*>.*?<\/h4>(.*?)<\/div>/gs)].map(m => m[1]);
    assert.match(records[0], /Sample 1<\/span><small[^>]*>被对方 Ban/);
    assert.doesNotMatch(records[0], /Sample 2<\/span><small[^>]*>被对方 Ban/);
    assert.match(records[1], /Sample 2<\/span><small[^>]*>被对方 Ban/);
    assert.doesNotMatch(html, /<input/);
  }
  const privateHtml = viewer({ ...props, match: { ...match, published: false, status: 'pending', winner: null } });
  assert(!privateHtml.includes('Sample') && !privateHtml.includes('950,000'));
  assert(privateHtml.includes('比赛尚未公布'));
  const byeHtml = viewer({ ...props, match: { ...match, status: 'bye', published: false, scores: [] } });
  assert(byeHtml.includes('轮空直接晋级'));
  console.log('PASS viewer/admin completed-match scores, designated song, totals, opponent-scoped bans, read-only result, unpublished privacy and bye display.');
} finally { await rm(dir, { recursive: true, force: true }); }
