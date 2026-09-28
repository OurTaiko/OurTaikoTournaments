import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';

const dir = await mkdtemp(tmpdir() + '/hachicats-match-concurrency-');
Object.assign(process.env, {
  DATABASE_PATH: dir + '/test.sqlite', MONGODB_URI: '', MONGODB_DB: '', VERCEL: '',
  DEMO_MODE: 'true', APP_ORIGIN: 'http://127.0.0.1:5195', SSO_CLIENT_SECRET: '',
});
const originalFetch = globalThis.fetch;
// All HTTP handlers execute in process; no external service is used by this test.
globalThis.fetch = async () => { throw new Error('Network disabled in concurrency tests'); };
try {
  await build({
    stdin: { contents: `export {matchGET as GET, matchPOST as POST} from './tests/fixtures/scoped-handlers'; export * from './lib/store'; export * from './lib/tournament-seed'; export * from './lib/tournament'; export * from './lib/player-management'; export * from './lib/reset-tournament';`, resolveDir: process.cwd() },
    bundle: true, platform: 'node', format: 'cjs', conditions: ['react-server'], outfile: dir + '/test.cjs',
  });
  const { GET, POST, db, readTournament, writeTournament, makeTournament, tournamentState, applyPlayerAction, resetTournament } = (await import(dir + '/test.cjs')).default;
  const database = db();
  await database.createTournament({ id: 'demo', revision: 0, body: JSON.stringify(tournamentState(makeTournament())) });
  await database.saveSession({ id: 'concurrency-test', body: JSON.stringify({ kind: 'demo' }), expires: Date.now() + 60000 });
  const a = 'siamese-r0-0', b = 'siamese-r0-1';
  const request = (id, body, auth = true, origin = process.env.APP_ORIGIN) => new Request(process.env.APP_ORIGIN + '/api/matches/' + id, {
    method: body ? 'POST' : 'GET',
    headers: { Origin: origin, 'Content-Type': 'application/json', ...(auth ? { Cookie: 'hachicats_session=concurrency-test' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const context = id => ({ params: Promise.resolve({ id }) });
  const read = async id => {
    const response = await GET(request(id), context(id));
    assert.equal(response.status, 200);
    return response.json();
  };
  const post = (snapshot, action, extra = {}) => POST(request(snapshot.match.id, {
    revision: snapshot.revision, matchRevision: snapshot.match.revision ?? 0, ...action, ...extra,
  }), context(snapshot.match.id));
  const action = (station, score = 100) => ({
    type: 'start', station,
    picks: [['siamese-1', 'siamese-2'], ['siamese-3', 'siamese-4']],
    bans: ['siamese-3', 'siamese-1'],
    scores: [{ songId: 'siamese-2', a: score, b: 90 }, { songId: 'siamese-4', a: score, b: 80 }],
  });
  const reset = async () => resetTournament(database, true, {
    revision: (await readTournament()).revision, confirmation: '重置演示赛事',
  }, 'local-concurrency-test');
  // Force both requests to read the same document before either CAS can succeed.
  const race = async tasks => {
    const update = database.updateTournament;
    let arrivals = 0, misses = 0, release;
    const gate = new Promise(resolve => { release = resolve; });
    database.updateTournament = async (...args) => {
      if (arrivals < 2) {
        arrivals++;
        if (arrivals === 2) release();
        await gate;
      }
      const ok = await update(...args);
      if (!ok) misses++;
      return ok;
    };
    try {
      const responses = await Promise.all(tasks.map(task => task()));
      assert.equal(misses, 1, 'A real whole-document CAS collision was exercised');
      return responses;
    } finally { database.updateTournament = update; }
  };

  const initialA = await read(a), initialB = await read(b);
  assert.equal(initialA.match.revision, undefined, 'Existing data needs no migration');
  assert.equal((await POST(request(a, { revision: 0, ...action('A') }, false), context(a))).status, 401);
  assert.equal((await POST(request(a, { revision: 0, ...action('A') }, true, 'https://untrusted.example'), context(a))).status, 403);
  for (const matchRevision of [-1, 1.5, '0', null, 1]) {
    assert.equal((await post(initialA, action('A'), { matchRevision })).status, 400);
  }
  assert.equal((await post(initialA, action('A'))).status, 200);
  assert.equal((await post(initialB, action('B'))).status, 200, 'Another match starting must not invalidate this editor');
  assert.equal((await post(initialA, action('A'))).status, 409, 'Repeated same-match submission is rejected');
  assert.equal((await post(initialB, action('B'), { matchRevision: undefined })).status, 409, 'Legacy clients retain global version protection');
  console.log('PASS independent starts from old global snapshots, legacy data/clients, auth and version validation.');

  const liveA = await read(a), liveB = await read(b);
  let responses = await race([
    () => post(liveA, { ...action('A', 111), type: 'save' }),
    () => post(liveB, { ...action('B', 222), type: 'save' }),
  ]);
  assert.deepEqual(responses.map(response => response.status), [200, 200]);
  let state = await readTournament();
  assert.equal(state.revision, liveA.revision + 2);
  assert.equal(state.matches.find(match => match.id === a).scores[0].a, 111);
  assert.equal(state.matches.find(match => match.id === b).scores[0].a, 222);
  assert(responses.every(response => response.headers.get('Cache-Control') === 'no-store'));
  // The successful response supplies the token for the next save without reopening.
  const savedA = await responses[0].json();
  assert.equal((await post(savedA, { ...action('A', 333), type: 'save' })).status, 200);
  console.log('PASS simultaneous A/B scoring with forced CAS retry; both scores persist and the returned token supports the next save.');

  const sameMatch = await read(a);
  responses = await race([
    () => post(sameMatch, { ...action('A', 444), type: 'save' }),
    () => post(sameMatch, { ...action('A', 555), type: 'save' }),
  ]);
  assert.deepEqual(responses.map(response => response.status).sort(), [200, 409]);
  const winner = await responses.find(response => response.status === 200).json();
  assert.equal((await read(a)).match.scores[0].a, winner.match.scores[0].a);
  console.log('PASS simultaneous edits to the same match reject the loser without overwriting the winner.');

  const finishA = await read(a), finishB = await read(b);
  responses = await race([
    () => post(finishA, { type: 'finish' }),
    () => post(finishB, { type: 'finish' }),
  ]);
  assert.deepEqual(responses.map(response => response.status), [200, 200]);
  const nextRound = (await read('siamese-r1-0')).match;
  assert.equal(nextRound.a.id, finishA.match.a.id);
  assert.equal(nextRound.b.id, finishB.match.a.id);
  console.log('PASS simultaneous finishes preserve both winners in the shared next-round match.');

  await reset();
  const startA = await read(a), startB = await read(b);
  responses = await race([() => post(startA, action('A')), () => post(startB, action('A'))]);
  assert.deepEqual(responses.map(response => response.status).sort(), [200, 400]);
  assert.match((await responses.find(response => response.status === 400).json()).error, /已有正在进行/);
  assert.equal((await readTournament()).matches.filter(match => match.status === 'live').length, 1);
  console.log('PASS simultaneous attempts to occupy the same station still allow exactly one match.');

  await reset();
  const pending = await read(a);
  await reset();
  assert.equal((await post(pending, action('A'))).status, 409, 'Reset invalidates even pristine pending matches');
  let before = await read(a);
  state = await readTournament();
  let next = applyPlayerAction(state, { type: 'edit', id: before.match.a.id, name: 'Local test player', rating: 6.25 });
  await writeTournament(next, state.revision);
  assert.equal((await post(before, action('A'))).status, 409, 'Profile edits invalidate the affected match');
  const swapA = await read(a), swapB = await read(b), untouched = await read('siamese-r0-2');
  state = await readTournament();
  next = applyPlayerAction(state, { type: 'replace', matchId: a, side: 'a', playerId: swapB.match.a.id });
  await writeTournament(next, state.revision);
  assert.equal((await post(swapA, action('A'))).status, 409);
  assert.equal((await post(swapB, action('B'))).status, 409);
  assert.equal((await read(untouched.match.id)).match.revision, untouched.match.revision);
  console.log('PASS resets and player profile/lineup changes invalidate affected editors while unrelated matches stay valid.');

  await reset();
  const downstream = await read('siamese-r1-0');
  before = await read(a);
  assert.equal((await post(before, { type: 'bye', winner: before.match.a.id })).status, 200);
  assert((await read(downstream.match.id)).match.revision > downstream.match.revision, 'Advancement stamps the downstream match');
  assert.equal((await post(downstream, { type: 'draft' })).status, 409);
  console.log('PASS advancement invalidates already-open downstream editors.');

  before = await read(b);
  const update = database.updateTournament;
  let attempts = 0;
  database.updateTournament = async () => { attempts++; return false; };
  try {
    const response = await post(before, action('B'));
    assert.equal(response.status, 409);
    assert.equal(attempts, 4, 'Retries are bounded');
    assert.match((await response.json()).error, /稍后再次提交/);
  } finally { database.updateTournament = update; }
  assert.equal((await read(b)).match.status, 'pending');
  console.log('PASS retry exhaustion returns a retryable error without changing the match.');
} finally {
  globalThis.fetch = originalFetch;
  await rm(dir, { recursive: true, force: true });
}
