import { samplePools } from "./fixtures/song-pools.mjs";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
const dir = await mkdtemp(tmpdir() + "/hachicats-tests-");
try {
  await build({
    stdin: {
      contents:
        "export * from './lib/rules'; export * from './lib/tournament'; export * from './lib/tournament-seed';",
      resolveDir: process.cwd(),
    },
    bundle: true,
    platform: "node",
    format: "esm",
    outfile: dir + "/rules.mjs",
  });
  const { makeTournament, applyAction: applyWithPool, publicTournament } = await import(
    pathToFileURL(dir + "/rules.mjs").href
  );
  const applyAction = (t, id, action) => applyWithPool(t, id, action, samplePools[t.matches.find(m => m.id === id)?.group] ?? []);
  let count = 0;
  const check = (name, fn) => {
    fn();
    count++;
    console.log("PASS " + name);
  };
  const action = {
    type: "start",
    picks: [
      ["siamese-1", "siamese-2"],
      ["siamese-3", "siamese-4"],
    ],
    bans: ["siamese-3", "siamese-1"],
    scores: [
      { songId: "siamese-2", a: 1000000, b: 990000 },
      { songId: "siamese-4", a: 980000, b: 995000 },
    ],
    station: "A",
  };
  check("48 players, 48 matches, three isolated groups", () => {
    const t = makeTournament();
    assert.equal(t.matches.length, 48);
    assert.equal(t.matches.filter((m) => m.a).length, 24);
  });
  check("draft selections never leak to spectators", () => {
    const t = applyAction(makeTournament(), "siamese-r0-0", {
      ...action,
      type: "draft",
    });
    const p = publicTournament(t).matches[0];
    assert.deepEqual(p.picks, [[], []]);
    assert.deepEqual(p.scores, []);
  });
  check("sum decides winner and feeds next bracket slot", () => {
    let t = applyAction(makeTournament(), "siamese-r0-0", action);
    t = applyAction(t, "siamese-r0-0", { type: "finish" });
    assert.equal(t.matches[0].winner, "siamese-p1");
    assert.equal(
      t.matches.find((m) => m.id === "siamese-r1-0").a.id,
      "siamese-p1",
    );
  });
  check("equal totals require a tiebreak", () => {
    const t = applyAction(makeTournament(), "siamese-r0-0", {
      ...action,
      scores: action.scores.map((s) => ({ ...s, b: s.a })),
    });
    assert.throws(
      () => applyAction(t, "siamese-r0-0", { type: "finish" }),
      /总分相同/,
    );
  });
  check("missing, negative and fractional scores rejected", () => {
    for (const value of [-1, 2.5, 2000001])
      assert.throws(() =>
        applyAction(makeTournament(), "siamese-r0-0", {
          ...action,
          scores: [{ ...action.scores[0], a: value }, action.scores[1]],
        }),
      );
    const t = applyAction(makeTournament(), "siamese-r0-0", {
      ...action,
      scores: [{ ...action.scores[0], a: null }, action.scores[1]],
    });
    assert.throws(
      () => applyAction(t, "siamese-r0-0", { type: "finish" }),
      /填完/,
    );
  });
  check("two parallel stations accepted; occupied station rejected", () => {
    let t = applyAction(makeTournament(), "siamese-r0-0", action);
    assert.throws(() => applyAction(t, "siamese-r0-1", action), /已有/);
    t = applyAction(t, "siamese-r0-1", { ...action, station: "B" });
    assert.equal(t.matches.filter((m) => m.status === "live").length, 2);
  });
  check(
    "bye advances selected actual player; unresolved round cannot bypass",
    () => {
      const t = applyAction(makeTournament(), "siamese-r0-0", {
        type: "bye",
        winner: "siamese-p0",
      });
      assert.equal(
        t.matches.find((m) => m.id === "siamese-r1-0").a.id,
        "siamese-p0",
      );
      assert.throws(
        () =>
          applyAction(t, "siamese-r1-0", { type: "bye", winner: "siamese-p0" }),
        /上一轮/,
      );
      assert.throws(() =>
        applyAction(t, "siamese-r0-1", { type: "bye", winner: "unknown" }),
      );
    },
  );
  check("confirmed results are immutable", () => {
    const t = applyAction(makeTournament(), "siamese-r0-0", {
      type: "bye",
      winner: "siamese-p0",
    });
    assert.throws(
      () =>
        applyAction(t, "siamese-r0-0", { type: "bye", winner: "siamese-p1" }),
      /已确认/,
    );
  });
  check(
    "ban must target opponent choice and banned songs cannot be played",
    () => {
      assert.throws(() =>
        applyAction(makeTournament(), "siamese-r0-0", {
          ...action,
          bans: ["siamese-1", "siamese-3"],
        }),
      );
      assert.throws(
        () =>
          applyAction(makeTournament(), "siamese-r0-0", {
            ...action,
            scores: [{ songId: "siamese-3", a: 1, b: 2 }, action.scores[1]],
          }),
        /禁用/,
      );
    },
  );
  check("semifinal loser goes to bronze match", () => {
    const t = makeTournament();
    const m = t.matches.find((x) => x.id === "siamese-r2-0");
    m.a = t.matches[0].a;
    m.b = t.matches[1].a;
    const started = applyAction(t, m.id, action);
    const finished = applyAction(started, m.id, { type: "finish" });
    assert.equal(
      finished.matches.find((x) => x.id === "siamese-r4-0").a.id,
      m.a.id,
    );
    assert.equal(
      finished.matches.find((x) => x.id === "siamese-r3-0").a.id,
      m.b.id,
    );
  });
  check("final requires designated song", () => {
    const t = makeTournament();
    const m = t.matches.find((x) => x.id === "siamese-r3-0");
    m.a = t.matches[0].a;
    m.b = t.matches[1].a;
    assert.throws(() => applyAction(t, m.id, action), /指定曲/);
  });
  check("previously played songs cannot be picked again", () => {
    let t = applyAction(makeTournament(), "siamese-r0-0", action);
    t = applyAction(t, "siamese-r0-0", { type: "finish" });
    t = applyAction(t, "siamese-r0-1", { type: "bye", winner: "siamese-p2" });
    assert.throws(
      () =>
        applyAction(t, "siamese-r1-0", {
          ...action,
          picks: [["siamese-4", "siamese-5"], action.picks[1]],
        }),
      /此前已游玩/,
    );
  });
  console.log(`${count} tournament rule checks passed.`);
} finally {
  await rm(dir, { recursive: true, force: true });
}
