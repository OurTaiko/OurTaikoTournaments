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
    t = api.applyClAction(t, id, { type: 'start', bans, picks, station: 'A', scores: rows(songs) });
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
  // Stage 1 forbids replaying a song; draws exclude what either player already played.
  assert.throws(() => api.applyClAction(t, 'G5', { type: 'start', station: 'A', scores: rows(['cl-3', 'cl-5']) }), /已游玩/);
  assert.deepEqual(api.clDrawable(t, m('G5'), [[], []], []), ['cl-1', 'cl-2', 'cl-5', 'cl-6', 'cl-7', 'cl-8', 'cl-9', 'cl-10']);
  // A tied total needs an extra drawn song before the result can be confirmed.
  t = api.applyClAction(t, 'G5', { type: 'start', station: 'A', scores: [{ songId: 'cl-5', a: 1, b: 1 }, { songId: 'cl-6', a: 1, b: 1 }] });
  assert.throws(() => api.applyClAction(t, 'G5', { type: 'finish' }), /加赛/);
  t = api.applyClAction(t, 'G5', { type: 'finish', scores: [{ songId: 'cl-5', a: 1, b: 1 }, { songId: 'cl-6', a: 1, b: 1 }, { songId: 'cl-7', a: 2, b: 1 }] });
  play('G6', { songs: ['cl-5', 'cl-6'], ...bWins(2) });
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
  // Final stage: first to 3 points; songs may repeat across matches; G14 lets the winners champion ban twice.
  const drawn = ['cl-21', 'cl-22', 'cl-23', 'cl-24'];
  t = api.applyClAction(t, 'G12', { type: 'start', station: 'A', bans: [['cl-19'], ['cl-20']], scores: rows(drawn) });
  t = api.applyClAction(t, 'G12', { type: 'finish', scores: drawn.map((songId, i) => ({ songId, a: i < 3 ? 2 : null, b: i < 3 ? 1 : null })) });
  assert.equal(m('G12').winner, m('G12').a);
  t = api.applyClAction(t, 'G13', { type: 'start', station: 'A', bans: [['cl-19'], ['cl-20']], scores: drawn.map((songId, i) => ({ songId, a: i % 2 ? 1 : 2, b: i % 2 ? 2 : 1 })) });
  assert.throws(() => api.applyClAction(t, 'G13', { type: 'finish' }), /决胜曲/);
  assert.throws(() => api.applyClAction(t, 'G13', { type: 'save', scores: [...m('G13').scores, { songId: 'special:winnersFinal', a: 1, b: 2 }] }), /曲库/);
  t = api.applyClAction(t, 'G13', { type: 'finish', scores: [...m('G13').scores, { songId: 'special:losersFinal', a: 1, b: 2 }] });
  assert.equal(m('G13').winner, m('G13').b);
  assert.throws(() => api.applyClAction(t, 'G14', { type: 'start', station: 'A', bans: [['cl-19'], ['cl-20']], scores: rows(drawn) }), /Ban/);
  assert.throws(() => api.applyClAction(t, 'G14', { type: 'draft', bans: [['cl-19', 'cl-20'], ['cl-21', 'cl-22']] }), /数量/);
  play('G14', { bans: [['cl-19', 'cl-20'], ['cl-21']], songs: ['cl-22', 'cl-23', 'cl-24', 'cl-25'], ...bWins(4) });
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

  // --- Scoped API: authorization, private designated songs, SQLite isolation ---
  const db = api.db();
  let admin = true;
  globalThis.fetch = async url => {
    if (String(url).includes('/internal/v1/web/introspect'))
      return Response.json({ user: { id: 'stable-user', username: 'u', nickname: 'U', isAdmin: admin }, expiresAt: new Date(Date.now() + 60000).toISOString() });
    assert.equal(String(url), 'https://cdn.ourtaiko.org/api/cnsongs');
    return Response.json([...Array.from({ length: 32 }, (_, i) => ({ id: i + 1, song_name: 'Sample ' + (i + 1), level_4: 9 })),
      { id: 900001, song_name: 'PRIVATE DESIGNATED SENTINEL', level_4: 10 }]);
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
  assert.equal(Object.keys(catalog.catalog).length, 32);
  assert.deepEqual(catalog.pools['1'], Array.from({ length: 10 }, (_, i) => `cl-${i + 1}`));
  assert(!JSON.stringify(catalog).includes('SENTINEL') && !JSON.stringify(catalog).includes('900001'));
  for (const [handler, path, body] of [[api.match, '/matches/G7'], [api.score, '/matches/G7', {}], [api.players, '/players', {}], [api.reset, '/reset', {}]])
    assert.equal((await handler(request(path, body, false), context('G7'))).status, 401);
  admin = false;
  assert.equal((await api.players(request('/players', { revision: 0, action: { type: 'add', name: 'x' } }), context())).status, 403);
  assert.deepEqual(await (await api.access(request('/access'), context())).json(), { canManage: false });
  admin = true;
  assert.deepEqual(await (await api.access(request('/access'), context())).json(), { canManage: true });
  // Replay the finished event through the API state, then check that G7's designated song is revealed.
  let revision = 0;
  for (let i = 1; i <= 8; i++) {
    const response = await api.players(request('/players', { revision, action: { type: 'add', name: `API${i}` } }), context());
    assert.equal(response.status, 200); revision = (await response.json()).tournament.revision;
  }
  assert.equal((await api.players(request('/players', { revision: 0, action: { type: 'add', name: 'stale' } }), context())).status, 409);
  const detail = await (await api.match(request('/matches/G7'), context('G7'))).json();
  assert.equal(detail.designated.title, 'PRIVATE DESIGNATED SENTINEL', 'Admins see the designated song before it is announced');
  assert.equal(detail.pool.length, 14);
  const stored = JSON.parse((await db.getTournament('centurylink-20261227')).body);
  const played = structuredClone(t);
  played.players = stored.players.map((p, i) => ({ ...p, rankingScore: t.players[i].rankingScore }));
  const rename = new Map(t.players.map((p, i) => [p.id, played.players[i].id]));
  played.ranking.seeds = t.ranking.seeds.map(id => rename.get(id));
  for (const x of played.matches) for (const key of ['a', 'b', 'winner']) if (x[key]) x[key] = rename.get(x[key]);
  played.revision = revision + 1;
  for (const x of played.matches) x.revision = played.revision;
  assert(await db.updateTournament({ id: 'centurylink-20261227', revision: played.revision, body: JSON.stringify(played) }, revision));
  const revealed = await (await api.songs(request('/songs'), context())).json();
  assert.equal(revealed.catalog['special:stage2'].title, 'PRIVATE DESIGNATED SENTINEL');
  assert.equal(revealed.catalog['special:grandFinal'], undefined, 'Unused tiebreak songs stay private');
  const reset = await api.reset(request('/reset', { revision: played.revision, confirmation: '重置第二届世纪汇单店赛' }), context());
  assert.equal(reset.status, 200);
  const afterReset = (await reset.json()).tournament;
  assert.deepEqual(afterReset.players.map(p => p.name), played.players.map(p => p.name));
  assert(afterReset.matches.every(x => x.status === 'pending' && !x.a && !x.scores.length));
  assert.equal(afterReset.ranking.status, 'pending');
  assert.equal(await db.getTournament('hachicats-20260927'), null, 'CenturyLink requests never initialize other events');
  console.log('PASS CenturyLink scoped API enforces admin/Origin/revision, keeps designated songs private until published, and resets with backup.');
} finally {
  globalThis.fetch = originalFetch;
  await rm(dir, { recursive: true, force: true });
}
