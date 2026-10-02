import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';

const dir = await mkdtemp(tmpdir() + '/tournament-obs-');
try {
  await build({
    stdin: { contents: `
      export { obsMatches } from './lib/obs-matches';
      export { makeTournament } from './lib/tournament-seed';
      export { makeCenturyLink } from './lib/centurylink';
      import { createElement } from 'react';
      import { renderToStaticMarkup } from 'react-dom/server';
      import ObsOverlay, { ObsMatchCard } from './components/obs/obs-overlay';
      export const card = props => renderToStaticMarkup(createElement(ObsMatchCard, props));
      export const archived = () => renderToStaticMarkup(createElement(ObsOverlay, {name: '存档赛事', apiPath: null}));
    `, resolveDir: process.cwd() },
    bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', outfile: dir + '/obs.cjs',
  });
  const { obsMatches, makeTournament, makeCenturyLink, card, archived } = (await import(dir + '/obs.cjs')).default;
  const tournament = makeTournament();
  assert.deepEqual(obsMatches(tournament), [], 'Pending matches do not enter the overlay');
  for (const [index, status, published, station] of [[0, 'live', true, 'B'], [1, 'live', true, 'A'], [2, 'live', false, 'A'], [3, 'complete', true, 'A'], [4, 'bye', true, 'A']]) {
    Object.assign(tournament.matches[index], { status, published, station });
  }
  const before = JSON.stringify(tournament);
  const live = obsMatches(tournament);
  assert.deepEqual(live.map(m => m.id), [tournament.matches[1].id, tournament.matches[0].id]);
  assert.deepEqual(live[0].totals, [null, null], 'Unrecorded is distinct from zero');
  assert.equal(JSON.stringify(tournament), before, 'Projection must not mutate stored state');

  const cl = makeCenturyLink([{ id: 'a', name: '选手 <A>', rankingScore: 100 }, { id: 'b', name: '选手 B', rankingScore: 90 }]);
  const first = cl.matches[0];
  Object.assign(first, { published: true, status: 'live', a: 'a', b: 'b', scores: [{ songId: 'cl-1', a: 0, b: null }] });
  const final = cl.matches.find(m => m.id === 'G12');
  Object.assign(final, { published: true, status: 'live', station: 'B', a: 'a', b: 'b', scores: [
    { songId: 'cl-19', a: 1000000, b: 900000 },
    { songId: 'cl-20', a: 800000, b: 1000000 },
    { songId: 'cl-21', a: 700000, b: 700000 },
    { songId: 'cl-22', a: null, b: 900000 },
  ] });
  let matches = obsMatches(cl);
  assert.deepEqual(matches.map(m => m.id), ['G1', 'G12']);
  assert.deepEqual(matches[0].totals, [0, null]);
  assert.deepEqual(matches[1].totals, [1, 1], 'Finals use song wins, excluding ties and incomplete scores');
  assert.equal(matches[1].scoreLabel, '胜曲数 · 先得 3 分');
  assert.deepEqual(matches[0].players, ['选手 <A>', '选手 B']);
  const html = card({ match: matches[1], catalog: { 'cl-19': { id: 'cl-19', title: '测试曲目', songID: 1, difficultyIndex: 5, stars: 10 } } });
  assert(html.includes('选手 &lt;A&gt;'));
  assert(html.includes('测试曲目') && html.includes('里谱面') && html.includes('1,000,000'));
  assert(html.includes('曲目信息加载中') && html.includes('—'));
  assert.doesNotMatch(html, /<(?:input|button|a)\b/);
  first.status = 'complete';
  matches = obsMatches(cl);
  assert.deepEqual(matches.map(m => m.id), ['G12'], 'Finished matches leave the rotation');
  final.published = false;
  assert.deepEqual(obsMatches(cl), [], 'Even a live status must not expose an unpublished draft');
  assert(archived().includes('赛事已结束'));
  console.log('PASS OBS live/public filtering, station order, immutable projection, totals/points, missing scores/catalog, escaping, finished removal and archive state.');
} finally { await rm(dir, { recursive: true, force: true }); }
