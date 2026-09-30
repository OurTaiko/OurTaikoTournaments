import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';

const dir = await mkdtemp(tmpdir() + '/centurylink-');
Object.assign(process.env, {
  DATABASE_PATH: dir + '/test.sqlite', MONGODB_URI: '', MONGODB_DB: '', VERCEL: '',
  DEMO_MODE: 'false', APP_ORIGIN: 'http://127.0.0.1:5192',
  SSO_ISSUER: 'https://sso.example', SSO_CLIENT_ID: 'existing-client', SSO_CLIENT_SECRET: 'test-only',
});
const originalFetch = globalThis.fetch;
try {
  await build({ stdin: { contents: `
    export * from './lib/centurylink';
    export * from './lib/centurylink-rules';
    export * from './lib/tournament-documents';
    export { demoCenturyLinkSongLibrary } from './lib/centurylink-song-library';
    export { db } from './lib/store';
    export { resetTournament } from './lib/reset-tournament';
    export { resolveTournamentScope } from './lib/tournament-scope';
    export {GET as state} from './app/api/tournaments/[series]/[edition]/route';
    export {GET as songs} from './app/api/tournaments/[series]/[edition]/songs/route';
    export {GET as access} from './app/api/tournaments/[series]/[edition]/access/route';
    export {GET as match, POST as score} from './app/api/tournaments/[series]/[edition]/matches/[id]/route';
    export {POST as players} from './app/api/tournaments/[series]/[edition]/players/route';
    export {POST as reset} from './app/api/tournaments/[series]/[edition]/reset/route';
  `, resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'cjs', conditions: ['react-server'], outfile: dir + '/test.cjs' });
  const api = (await import(dir + '/test.cjs')).default;

  // --- Rules: roster, ranking and the complete double-elimination bracket ---
  let t = api.makeCenturyLink();
  const act = (action) => { t = api.applyClPlayerAction(t, action); };
  for (let i = 1; i <= 8; i++) act({ type: 'add', name: `P${i}` });
  assert.throws(() => act({ type: 'add', name: 'P9' }), /最多 8/);
  assert.throws(() => act({ type: 'add', name: '  ' }));
  const ids = t.players.map(p => p.id);
  act({ type: 'edit', id: ids[0], name: 'Renamed' });
  assert.equal(t.players[0].name, 'Renamed');
  assert.throws(() => act({ type: 'ranking-confirm', order: ids }), /分数/);
  // P1..P8 score descending, with a tie between P4 and P5.
  act({ type: 'ranking-scores', scores: ids.map((id, i) => ({ id, score: i === 4 ? 997000 : 1000000 - i * 1000 })) });
  assert.equal(t.ranking.status, 'live');
  assert.throws(() => act({ type: 'ranking-confirm', order: [ids[1], ids[0], ...ids.slice(2)] }), /从高到低/);
  const seeds = [ids[0], ids[1], ids[2], ids[4], ids[3], ids[5], ids[6], ids[7]]; // tie broken by staff
  act({ type: 'ranking-confirm', order: seeds });
  assert.throws(() => act({ type: 'add', name: 'Late' }), /锁定|排位已确认/);
  const m = id => t.matches.find(x => x.id === id);
  assert.deepEqual(['G1', 'G2', 'G3', 'G4'].map(id => [m(id).a, m(id).b]),
    [[seeds[0], seeds[7]], [seeds[1], seeds[6]], [seeds[2], seeds[5]], [seeds[3], seeds[4]]]);
  const rows = songs => songs.map(songId => ({ songId, a: null, b: null }));
  const play = (id, { bans = [[], []], picks = [[], []], songs, a, b }) => {
    if (api.clDefinition(id).kind === 'points') {
      t = api.applyClAction(t, id, { type: 'start', bans, picks, station: 'A', scores: rows(songs.slice(0, 1)) });
      for (let i = 1; i < songs.length; i++)
        t = api.applyClAction(t, id, { type: 'save', scores: [
          ...songs.slice(0, i).map((songId, j) => ({ songId, a: a[j], b: b[j] })), ...rows([songs[i]]),
        ] });
    } else t = api.applyClAction(t, id, { type: 'start', bans, picks, station: 'A', scores: rows(songs) });
    t = api.applyClAction(t, id, { type: 'finish', scores: songs.map((songId, i) => ({ songId, a: a[i], b: b[i] })) });
  };
  const aWins = n => ({ a: Array(n).fill(990000), b: Array(n).fill(980000) });
  const bWins = n => ({ a: Array(n).fill(980000), b: Array(n).fill(990000) });
  assert.throws(() => api.applyClAction(t, 'G1', { type: 'draft', bans: [['cl-1'], ['cl-1']] }), /同一首/);
  assert.throws(() => api.applyClAction(t, 'G1', { type: 'draft', bans: [['cl-1'], ['cl-2']], picks: [['cl-1'], ['cl-3']] }), /未被禁用/);
  assert.throws(() => api.applyClAction(t, 'G1', { type: 'draft', bans: [['cl-11'], ['cl-2']] }), /本阶段曲库/);
  assert.throws(() => api.applyClAction(t, 'G5', { type: 'draft' }), /双方选手到位/);
  const stage1 = { bans: [['cl-1'], ['cl-2']], picks: [['cl-3'], ['cl-4']], songs: ['cl-3', 'cl-4'] };
  for (const id of ['G1', 'G2', 'G3', 'G4']) play(id, { ...stage1, ...aWins(2) });
  assert.throws(() => act({ type: 'ranking-reopen' }), /不能撤回/);
  assert.equal(m('G7').a, seeds[0]); assert.equal(m('G5').a, seeds[7]); assert.equal(m('G5').b, seeds[4]);
  // G5/G6 use the same ban/pick format as the first round, excluding songs already played.
  for (const id of ['G5', 'G6']) {
    assert.equal(api.clDefinition(id).kind, 'pickban');
    assert.equal(api.clBanCount(id, 0), 1); assert.equal(api.clPickCount(id), 1);
    assert.throws(() => api.applyClAction(t, id, { type: 'start', scores: rows(['cl-5', 'cl-6']) }), /Ban/);
    assert.throws(() => api.applyClAction(t, id, { type: 'start', bans: [['cl-1'], ['cl-2']], scores: rows(['cl-5', 'cl-6']) }), /选曲/);
  }
  assert.throws(() => api.applyClAction(t, 'G5', { type: 'start', station: 'A', scores: rows(['cl-3', 'cl-5']) }), /已游玩/);
  assert.deepEqual(api.clDrawable(t, m('G5'), [[], []], []), ['cl-1', 'cl-2', 'cl-5', 'cl-6', 'cl-7', 'cl-8', 'cl-9', 'cl-10']);
  // A tied total needs an extra drawn song before the result can be confirmed.
  const lowerStage1 = { bans: [['cl-1'], ['cl-2']], picks: [['cl-5'], ['cl-6']], songs: ['cl-5', 'cl-6'] };
  assert.throws(() => api.applyClAction(t, 'G5', { type: 'draft', ...lowerStage1, picks: [['cl-3'], ['cl-6']] }), /未游玩/);
  assert.throws(() => api.applyClAction(t, 'G5', { type: 'start', ...lowerStage1, scores: rows(['cl-7', 'cl-8']) }), /所选曲目/);
  t = api.applyClAction(t, 'G5', { type: 'start', station: 'A', ...lowerStage1, scores: [{ songId: 'cl-5', a: 1, b: 1 }, { songId: 'cl-6', a: 1, b: 1 }] });
  assert.throws(() => api.applyClAction(t, 'G5', { type: 'finish' }), /加赛/);
  t = api.applyClAction(t, 'G5', { type: 'finish', scores: [{ songId: 'cl-5', a: 1, b: 1 }, { songId: 'cl-6', a: 1, b: 1 }, { songId: 'cl-7', a: 2, b: 1 }] });
  play('G6', { ...lowerStage1, ...bWins(2) });
  // Stage 2: one ban, one pick each, then the designated song.
  const stage2 = (songs, special = 'special:stage2') => ({ bans: [['cl-5'], ['cl-6']], picks: [[songs[0]], [songs[1]]], songs: [...songs, special] });
  assert.throws(() => api.applyClAction(t, 'G7', { type: 'start', station: 'A', ...stage2(['cl-7', 'cl-8'], 'special:fourth'), scores: rows(['cl-7', 'cl-8', 'special:fourth']) }), /曲库/);
  play('G7', { ...stage2(['cl-7', 'cl-8']), ...aWins(3) });
  play('G8', { ...stage2(['cl-7', 'cl-8']), ...bWins(3) });
  assert.equal(m('G9').b, m('G8').a, 'G8 loser drops to the 1-1 group');
  assert.throws(() => api.applyClAction(t, 'G9', { type: 'draft', bans: [['cl-5'], ['cl-6']], picks: [['cl-7'], ['cl-9']] }), /未游玩/);
  play('G9', { ...stage2(['cl-9', 'cl-10']), ...aWins(3) });
  play('G10', { ...stage2(['cl-9', 'cl-10']), ...bWins(3) });
  play('G11', { ...stage2(['cl-11', 'cl-12'], 'special:fourth'), ...aWins(3) });
  const finalsReady = structuredClone(t);
  // Final stage: first to 3 points; songs may repeat across matches; G14 lets the winners champion ban twice.
  const drawn = ['cl-21', 'cl-22', 'cl-23', 'cl-24'];
  const finalBans = [['cl-19'], ['cl-20']];
  assert.throws(() => api.applyClAction(t, 'G12', { type: 'draft', bans: finalBans, scores: rows(drawn) }), /逐首/);
  t = api.applyClAction(t, 'G12', { type: 'draft', bans: finalBans, scores: rows(drawn.slice(0, 1)) });
  assert.throws(() => api.applyClAction(t, 'G12', { type: 'draft', bans: [['cl-25'], ['cl-20']] }), /不能修改 Ban/);
  assert.throws(() => api.applyClAction(t, 'G12', { type: 'draft', scores: [] }), /不能删除/);
  assert.throws(() => api.applyClAction(t, 'G12', { type: 'draft', scores: rows(['cl-22']) }), /不能删除/);
  assert.throws(() => api.applyClAction(t, 'G12', { type: 'draft', scores: rows(drawn.slice(0, 2)) }), /先开始/);
  t = api.applyClAction(t, 'G12', { type: 'start', station: 'A' });
  assert.equal(m('G12').scores.length, 1);
  assert.equal(api.publicCenturyLink(t).matches.find(m => m.id === 'G12').scores.length, 1);
  assert.throws(() => api.applyClAction(t, 'G12', { type: 'save', scores: rows(drawn.slice(0, 2)) }), /录完/);
  assert.throws(() => api.applyClAction(t, 'G12', { type: 'finish' }), /尚未决出/);
  for (let i = 1; i < 3; i++) {
    assert.throws(() => api.applyClAction(t, 'G12', { type: 'save', scores: [
      ...m('G12').scores.map(s => ({ ...s, a: 2, b: 1 })), ...rows(drawn.slice(i, i + 2)),
    ] }), /逐首/);
    t = api.applyClAction(t, 'G12', { type: 'save', scores: [
      ...m('G12').scores.map(s => ({ ...s, a: 2, b: 1 })), ...rows([drawn[i]]),
    ] });
    assert.equal(m('G12').scores.length, i + 1);
  }
  const threeWins = m('G12').scores.map(s => ({ ...s, a: 2, b: 1 }));
  assert.throws(() => api.applyClAction(t, 'G12', { type: 'save', scores: [...threeWins, ...rows([drawn[3]])] }), /已决出/);
  assert.throws(() => api.applyClAction(t, 'G12', { type: 'save', scores: [...m('G12').scores.slice(0, 2).map(s => ({ ...s, a: 2, b: 1 })), ...rows(['special:winnersFinal'])] }), /不能删除/);
  t = api.applyClAction(t, 'G12', { type: 'finish', scores: threeWins });
  assert.equal(m('G12').winner, m('G12').a);
  // Existing four-song sheets can still be scored without rewriting the stored draw.
  const legacy = structuredClone(finalsReady), legacyMatch = legacy.matches.find(m => m.id === 'G12');
  Object.assign(legacyMatch, { status: 'live', published: true, bans: finalBans, scores: rows(drawn) });
  const legacyDone = api.applyClAction(legacy, 'G12', { type: 'finish', scores: drawn.map((songId, i) => ({ songId, a: i < 3 ? 2 : null, b: i < 3 ? 1 : null })) });
  assert.equal(legacyDone.matches.find(m => m.id === 'G12').scores.length, 4);
  assert.equal(legacyMatch.status, 'live', 'Rule calculation does not mutate existing state');
  t = api.applyClAction(t, 'G13', { type: 'start', station: 'A', bans: finalBans, scores: rows(drawn.slice(0, 1)) });
  for (let i = 1; i < 4; i++) t = api.applyClAction(t, 'G13', { type: 'save', scores: [
    ...drawn.slice(0, i).map((songId, j) => ({ songId, a: j % 2 ? 1 : 2, b: j % 2 ? 2 : 1 })), ...rows([drawn[i]]),
  ] });
  t = api.applyClAction(t, 'G13', { type: 'save', scores: m('G13').scores.map((s, i) => ({ ...s, a: i % 2 ? 1 : 2, b: i % 2 ? 2 : 1 })) });
  assert.throws(() => api.applyClAction(t, 'G13', { type: 'finish' }), /决胜曲/);
  assert.throws(() => api.applyClAction(t, 'G13', { type: 'save', scores: [...m('G13').scores, { songId: 'special:winnersFinal', a: 1, b: 2 }] }), /曲库/);
  assert.throws(() => api.applyClAction(t, 'G13', { type: 'save', scores: [...m('G13').scores, ...rows(['cl-25'])] }), /须先演奏/);
  t = api.applyClAction(t, 'G13', { type: 'save', scores: [...m('G13').scores, { songId: 'special:losersFinal', a: 1, b: 1 }] });
  assert.throws(() => api.applyClAction(t, 'G13', { type: 'finish' }), /决胜曲/);
  t = api.applyClAction(t, 'G13', { type: 'save', scores: [...m('G13').scores, ...rows(['cl-25'])] });
  t = api.applyClAction(t, 'G13', { type: 'finish', scores: m('G13').scores.map((s, i) => i === 5 ? { ...s, a: 1, b: 2 } : s) });
  assert.equal(m('G13').winner, m('G13').b);
  assert.throws(() => api.applyClAction(t, 'G14', { type: 'start', station: 'A', bans: [['cl-19'], ['cl-20']], scores: rows(drawn) }), /Ban/);
  assert.throws(() => api.applyClAction(t, 'G14', { type: 'draft', bans: [['cl-19', 'cl-20'], ['cl-21', 'cl-22']] }), /数量/);
  play('G14', { bans: [['cl-19', 'cl-20'], ['cl-21']], songs: ['cl-22', 'cl-23', 'cl-24', 'cl-25'], a: [2, 1, 1, 1], b: [1, 2, 2, 2] });
  const standings = api.clStandings(t);
  assert.equal(new Set(standings.map(s => s.playerId)).size, 8);
  assert.equal(standings[0].playerId, m('G14').b);
  assert.throws(() => api.applyClAction(t, 'G14', { type: 'draft' }), /已确认/);
  console.log('PASS CenturyLink ranking seeds, ban/pick/draw/designated/points rules, stage no-repeat, tiebreaks, advancement and standings.');

  // --- Native document round trip and public filtering ---
  const row = { id: 'centurylink-20261227', revision: t.revision, body: JSON.stringify(t) };
  const parts = api.splitTournament(row);
  assert.equal(parts.tournament.format, 'centurylink');
  assert.equal(parts.participants.length, 8);
  assert.equal(parts.matches.length, 14);
  assert.equal(new Set(parts.matches.map(x => JSON.stringify([x.group, x.round, x.index]))).size, 14, 'Unique index key per match');
  assert.deepEqual(JSON.parse(api.joinTournament(parts.tournament, parts.participants.toReversed(), parts.matches.toReversed()).body), t);
  for (const mutate of [s => { s.revision++; }, s => { s.matches[0].a = 'missing'; }, s => { s.extra = 1; }, s => { s.ranking.seeds.push('missing'); }]) {
    const broken = structuredClone(t); mutate(broken);
    assert.throws(() => api.splitTournament({ ...row, body: JSON.stringify(broken) }));
  }
  const hidden = structuredClone(t); hidden.matches[0].published = false;
  assert.deepEqual(api.publicCenturyLink(hidden).matches[0].scores, []);
  const pending = api.makeCenturyLink([{ id: 'p', name: 'p', rankingScore: 123 }]);
  assert.equal(api.publicCenturyLink(pending).players[0].rankingScore, null);
  console.log('PASS CenturyLink state round-trips through native split documents; malformed references fail closed; drafts stay private.');

  // --- Scoped API: authorization, all announced songs, SQLite isolation ---
  const db = api.db();
  let admin = true;
  let ssoFails = false;
  globalThis.fetch = async url => {
    if (String(url).includes('/internal/v1/web/introspect')) {
      if (ssoFails) throw new Error('SSO unavailable');
      return Response.json({ user: { id: 'stable-user', username: 'u', nickname: 'U', isAdmin: admin }, expiresAt: new Date(Date.now() + 60000).toISOString() });
    }
    assert.equal(String(url), 'https://cdn.ourtaiko.org/api/cnsongs');
    return Response.json([...Array.from({ length: 32 }, (_, i) => ({ id: i + 1, song_name: 'Sample ' + (i + 1), level_4: 9 })),
      { id: 900001, song_name: 'ANNOUNCED DESIGNATED SAMPLE', level_4: 10 }]);
  };
  await db.saveSession({ id: 'test-user', body: JSON.stringify({ kind: 'user', sub: 'stable-user', token: 't' }), expires: Date.now() + 120000 });
  const base = process.env.APP_ORIGIN + '/api/tournaments/centurylink/20261227';
  const context = (id = 'G1', edition = '20261227') => ({ params: Promise.resolve({ series: 'centurylink', edition, id }) });
  const request = (path = '', body, auth = true) => new Request(base + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Origin: process.env.APP_ORIGIN, ...(auth ? { Cookie: 'hachicats_session=test-user' } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  assert.equal((await api.state(request(), context('G1', '20261228'))).status, 404);
  const initial = await (await api.state(request(), context())).json();
  assert.equal(initial.tournament.format, 'centurylink');
  assert.equal(initial.tournament.players.length, 0);
  assert.equal((await api.songs(request('/songs'), context())).status, 503, 'Production library must be imported explicitly');
  const library = api.demoCenturyLinkSongLibrary('centurylink-20261227');
  library.designated.stage2 = { songID: 900001, difficultyIndex: 4 };
  await db.createSongLibrary(library);
  const catalog = await (await api.songs(request('/songs'), context())).json();
  assert.equal(Object.keys(catalog.catalog).length, 38);
  assert.deepEqual(catalog.pools['1'], Array.from({ length: 10 }, (_, i) => `cl-${i + 1}`));
  for (const key of api.clDesignatedKeys) assert(catalog.catalog[api.clSpecialId(key)], 'All designated songs are available before play');
  assert.equal(catalog.catalog['special:stage2'].title, 'ANNOUNCED DESIGNATED SAMPLE');
  const anonymousCatalog = await api.songs(request('/songs', undefined, false), context());
  assert.equal(anonymousCatalog.status, 200);
  assert.equal(anonymousCatalog.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual((await anonymousCatalog.json()).catalog, catalog.catalog);
  for (const [handler, path, body] of [[api.match, '/matches/G7'], [api.score, '/matches/G7', {}], [api.players, '/players', {}], [api.reset, '/reset', {}]])
    assert.equal((await handler(request(path, body, false), context('G7'))).status, 401);
  admin = false;
  assert.equal((await api.players(request('/players', { revision: 0, action: { type: 'add', name: 'x' } }), context())).status, 403);
  assert.deepEqual(await (await api.access(request('/access'), context())).json(), { canManage: false });
  admin = true;
  assert.deepEqual(await (await api.access(request('/access'), context())).json(), { canManage: true });
  // Replay the finished event through the API state; catalog visibility does not depend on progress.
  let revision = 0;
  for (let i = 1; i <= 8; i++) {
    const response = await api.players(request('/players', { revision, action: { type: 'add', name: `API${i}` } }), context());
    assert.equal(response.status, 200); revision = (await response.json()).tournament.revision;
  }
  assert.equal((await api.players(request('/players', { revision: 0, action: { type: 'add', name: 'stale' } }), context())).status, 409);
  const detail = await (await api.match(request('/matches/G7'), context('G7'))).json();
  assert.equal(detail.designated.title, 'ANNOUNCED DESIGNATED SAMPLE');
  assert.equal(detail.pool.length, 14);
  const stored = JSON.parse((await db.getTournament('centurylink-20261227')).body);
  const ready = structuredClone(finalsReady);
  ready.players = stored.players.map((p, i) => ({ ...p, rankingScore: finalsReady.players[i].rankingScore }));
  const readyRename = new Map(finalsReady.players.map((p, i) => [p.id, ready.players[i].id]));
  ready.ranking.seeds = ready.ranking.seeds.map(id => readyRename.get(id));
  for (const x of ready.matches) for (const key of ['a', 'b', 'winner']) if (x[key]) x[key] = readyRename.get(x[key]);
  ready.revision = revision + 1;
  for (const x of ready.matches) x.revision = ready.revision;
  assert(await db.updateTournament({ id: 'centurylink-20261227', revision: ready.revision, body: JSON.stringify(ready) }, revision));
  revision = ready.revision;
  const firstDraw = { type: 'draft', revision, matchRevision: revision, bans: finalBans, scores: rows(['cl-21']) };
  const beforeDenied = await db.getTournament('centurylink-20261227');
  const wrongOrigin = request('/matches/G12', firstDraw); wrongOrigin.headers.set('Origin', 'https://wrong.example');
  assert.equal((await api.score(wrongOrigin, context('G12'))).status, 403);
  ssoFails = true;
  assert.equal((await api.score(request('/matches/G12', firstDraw), context('G12'))).status, 503);
  ssoFails = false;
  assert.deepEqual(await db.getTournament('centurylink-20261227'), beforeDenied, 'Rejected Origin/SSO writes preserve all stored data');
  let saved = await api.score(request('/matches/G12', firstDraw), context('G12'));
  assert.equal(saved.status, 200);
  let savedBody = await saved.json(); revision = savedBody.revision;
  assert.equal(savedBody.match.scores.length, 1);
  const unpublished = (await (await api.state(request('', undefined, false), context())).json()).tournament;
  assert.deepEqual(unpublished.matches.find(m => m.id === 'G12').scores, [], 'Draw draft stays private');
  saved = await api.score(request('/matches/G12', { type: 'start', revision, matchRevision: savedBody.match.revision }), context('G12'));
  assert.equal(saved.status, 200); savedBody = await saved.json(); revision = savedBody.revision;
  const secondDraw = { type: 'save', revision, matchRevision: savedBody.match.revision, scores: [{ songId: 'cl-21', a: 2, b: 1 }, ...rows(['cl-22'])] };
  saved = await api.score(request('/matches/G12', secondDraw), context('G12'));
  assert.equal(saved.status, 200); savedBody = await saved.json(); revision = savedBody.revision;
  assert.equal((await api.score(request('/matches/G12', secondDraw), context('G12'))).status, 409, 'Stale draw cannot overwrite stored result');
  assert.equal((await api.score(request('/matches/G12', { type: 'save', revision, matchRevision: savedBody.match.revision, scores: [...savedBody.match.scores, ...rows(['cl-23'])] }), context('G12'))).status, 400);
  assert.deepEqual((await (await api.match(request('/matches/G12'), context('G12'))).json()).match, savedBody.match, 'Reopened editor retains drawn songs and scores');
  const publicLive = (await (await api.state(request('', undefined, false), context())).json()).tournament;
  assert.deepEqual(publicLive.matches.find(m => m.id === 'G12').scores, savedBody.match.scores, 'Public live sheet contains only two drawn songs');
  const played = structuredClone(t);
  played.players = stored.players.map((p, i) => ({ ...p, rankingScore: t.players[i].rankingScore }));
  const rename = new Map(t.players.map((p, i) => [p.id, played.players[i].id]));
  played.ranking.seeds = t.ranking.seeds.map(id => rename.get(id));
  for (const x of played.matches) for (const key of ['a', 'b', 'winner']) if (x[key]) x[key] = rename.get(x[key]);
  played.revision = revision + 1;
  for (const x of played.matches) x.revision = played.revision;
  assert(await db.updateTournament({ id: 'centurylink-20261227', revision: played.revision, body: JSON.stringify(played) }, revision));
  const revealed = await (await api.songs(request('/songs'), context())).json();
  assert.deepEqual(revealed.catalog, catalog.catalog, 'Unused tiebreak songs are already announced');
  const reset = await api.reset(request('/reset', { revision: played.revision, confirmation: '重置第二届世纪汇单店赛' }), context());
  assert.equal(reset.status, 200);
  const afterReset = (await reset.json()).tournament;
  assert.deepEqual(afterReset.players.map(p => p.name), played.players.map(p => p.name));
  assert(afterReset.matches.every(x => x.status === 'pending' && !x.a && !x.scores.length));
  assert.equal(afterReset.ranking.status, 'pending');
  assert.deepEqual((await (await api.songs(request('/songs', undefined, false), context())).json()).catalog, catalog.catalog, 'Reset does not hide announced songs');
  assert.equal(await db.getTournament('hachicats-20260927'), null, 'CenturyLink requests never initialize other events');
  console.log('PASS CenturyLink scoped API enforces admin/Origin/SSO/revision, persists sequential draws, publishes all announced songs before play, and resets with backup.');
} finally {
  globalThis.fetch = originalFetch;
  await rm(dir, { recursive: true, force: true });
}
