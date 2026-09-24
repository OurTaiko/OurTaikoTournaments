import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";

const dir = await mkdtemp(tmpdir() + "/hachicats-players-");
process.env.DATABASE_PATH = dir + "/test.sqlite";
process.env.DEMO_MODE = "false";
process.env.MONGODB_URI = "";
process.env.VERCEL = "";
try {
  await build({
    stdin: {
      contents: "export * from './lib/players'; export * from './lib/tournament'; export * from './lib/store'; export * from './lib/rules';",
      resolveDir: process.cwd(),
    },
    bundle: true,
    platform: "node",
    format: "cjs",
    outfile: dir + "/players.cjs",
  });
  const { rosters, makeTournament, hydrateTournament, tournamentState, readTournament, writeTournament, db, applyAction, publicTournament, firstAttack } =
    (await import(pathToFileURL(dir + "/players.cjs").href)).default;
  const profiles = Object.values(rosters).flat();
  assert.equal(profiles.length, 48);
  assert.equal(new Set(profiles.map((p) => p.id)).size, 48);
  for (const [group, players] of Object.entries(rosters)) {
    assert.equal(players.length, 16);
    players.forEach((player, index) => {
      assert.equal(player.id, `${group}-p${index}`);
      assert.equal(player.seed, index + 1);
      assert.ok(typeof player.name === "string" && player.name.trim());
      assert.ok(Number.isFinite(player.rating) && player.rating >= 0);
      assert.equal(Number(player.rating.toFixed(2)), player.rating);
    });
  }
  assert.equal(profiles.find((p) => p.id === "tabby-p10").name, "97");
  assert.equal(profiles.find((p) => p.id === "siamese-p7").rating, 0.22);
  assert.deepEqual(profiles.find((p) => p.id === "ragdoll-p5"), {
    id: "ragdoll-p5", name: "社畜桑", seed: 6, rating: 11.06,
  });
  console.log("PASS 48 valid JSON profiles, original bracket order, numeric nickname and rating precision");

  const opener = makeTournament().matches[0];
  for (const [a, b, expected] of [
    [7.50, 7.00, opener.b.id], [7.00, 7.50, opener.a.id],
    [7.50, 7.01, null], [7.00, 7.00, null],
    [0.22, 0.72, opener.a.id], [10.03, 10.54, opener.a.id],
  ]) {
    const match = { ...opener, a: { ...opener.a, rating: a }, b: { ...opener.b, rating: b } };
    assert.equal(firstAttack(match), expected);
    assert.equal(firstAttack({ ...match, round: 1 }), expected);
    for (const round of [2, 3, 4]) assert.equal(firstAttack({ ...match, round }), null);
    assert.equal(firstAttack({ ...match, b: null }), null);
    assert.equal(firstAttack({ ...match, status: "bye" }), null);
  }
  console.log("PASS first-attack rating threshold, both sides, eligible rounds, pending slots and byes");

  // Simulate a production database from before JSON profiles, including later rounds.
  const legacy = makeTournament(true);
  legacy.revision = 19;
  for (const match of legacy.matches) for (const side of ["a", "b"]) {
    if (!match[side]) continue;
    match[side].name = "旧的错误姓名";
    delete match[side].rating;
  }
  await db().createTournament({ id: "edition-1", revision: legacy.revision, body: JSON.stringify(legacy) });
  const current = await readTournament();
  assert.deepEqual(tournamentState(current), tournamentState(legacy));
  for (const match of current.matches) for (const side of ["a", "b"]) {
    if (!match[side]) continue;
    assert.deepEqual(match[side], profiles.find((p) => p.id === match[side].id));
  }
  assert.equal(current.matches.find((m) => m.id === "siamese-r1-0").a.rating, 7.5);
  assert.equal(publicTournament(current).matches[0].a.rating, 7.5);
  assert.equal(current.matches.find((m) => m.id === "ragdoll-r3-0").a, null);
  const unchanged = await db().getTournament("edition-1");
  assert.deepEqual(JSON.parse(unchanged.body), legacy);
  console.log("PASS legacy names refreshed across all rounds without changing scores, winners, revision or stored data");

  const match = current.matches.find((m) => m.id === "ragdoll-r0-2");
  const next = applyAction(current, match.id, { type: "bye", winner: match.b.id });
  await writeTournament(next, current.revision);
  const saved = JSON.parse((await db().getTournament("edition-1")).body);
  assert.deepEqual(saved.matches.find((m) => m.id === match.id).b, { id: "ragdoll-p5", seed: 6 });
  assert.deepEqual(hydrateTournament(saved), next);
  assert.deepEqual(await readTournament(), next);
  assert.equal(next.matches.find((m) => m.id === "ragdoll-r1-1").a.rating, 11.06);
  await assert.rejects(() => writeTournament(current, current.revision), /刚被/);
  console.log("PASS normalized ID persistence, rating after advancement, round-trip and stale-write protection");
} finally {
  await rm(dir, { recursive: true, force: true });
}
