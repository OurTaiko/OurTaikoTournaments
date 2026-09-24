import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";

const dir = await mkdtemp(tmpdir() + "/hachicats-songs-");
const originalFetch = globalThis.fetch;
const originalNow = Date.now;
try {
  await build({
    stdin: { contents: "export * from './lib/songs'; export * from './lib/song-catalog.server'; export * from './lib/tournament'; export * from './lib/rules';", resolveDir: process.cwd() },
    bundle: true, platform: "node", format: "esm", outfile: dir + "/songs.mjs",
  });
  const { songs, parseSongMetadata, resolveSong, songName, designatedId, publicSongCatalog, songMetadata, makeTournament, hydrateTournament, applyAction } =
    await import(pathToFileURL(dir + "/songs.mjs").href);
  const pools = JSON.parse(await readFile("data/songs.json", "utf8"));
  const designated = JSON.parse(await readFile("data/designated-songs.json", "utf8"));
  for (const [group, pool] of Object.entries(pools)) {
    assert.equal(Object.keys(pool).length, 12);
    assert.deepEqual(Object.keys(pool), Array.from({ length: 12 }, (_, i) => `${group}-${i + 1}`));
  }
  for (const ref of [...Object.values(pools).flatMap(Object.values), ...Object.values(designated).flatMap(Object.values)]) {
    assert.deepEqual(Object.keys(ref).sort(), ["difficultyIndex", "songID"]);
    assert.ok(Number.isSafeInteger(ref.songID) && ref.songID > 0);
    assert.ok(Number.isInteger(ref.difficultyIndex) && ref.difficultyIndex >= 1 && ref.difficultyIndex <= 5);
  }
  const rows = [
    { id: 433, song_name: "原版实时曲名", level_1: 3, level_2: 6, level_3: 7, level_4: 8, level_5: 9 },
    { id: 1265, song_name: "同名演唱版", level_4: 10, level_5: "-" },
    { id: 187, song_name: "未公开指定曲", level_4: 9 },
  ];
  const metadata = parseSongMetadata(rows);
  for (let difficultyIndex = 1; difficultyIndex <= 5; difficultyIndex++) {
    assert.equal(resolveSong("test", { songID: 433, difficultyIndex }, metadata).stars, rows[0][`level_${difficultyIndex}`]);
  }
  assert.equal(resolveSong("test", { songID: 1265, difficultyIndex: 5 }, metadata).stars, null);
  assert.equal(resolveSong("test", { songID: 999999, difficultyIndex: 4 }, metadata).stars, null);
  assert.throws(() => parseSongMetadata({ error: "bad" }));
  assert.throws(() => parseSongMetadata([]));
  assert.equal(resolveSong("siamese-4", pools.siamese["siamese-4"], metadata).title, "原版实时曲名");
  assert.equal(songName("siamese", "test", { test: resolveSong("test", { songID: 433, difficultyIndex: 5 }, metadata) }), "原版实时曲名（里谱面）");
  console.log("PASS JSON references, all five difficulty fields, exact song IDs, missing charts and invalid API responses");

  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error("offline"); };
  const offline = await publicSongCatalog(makeTournament());
  assert.equal(offline.stale, true);
  assert.equal(offline.updatedAt, null);
  assert.equal(offline.catalog["siamese-4"].stars, null);
  globalThis.fetch = async (url, options) => {
    calls++;
    assert.equal(url, "https://cdn.ourtaiko.org/api/cnsongs");
    assert.equal(options.cache, "no-store");
    return Response.json(rows);
  };
  const [fresh, concurrent] = await Promise.all([songMetadata(), songMetadata()]);
  assert.equal(calls, 2); // One initial failure, one shared request for both callers.
  assert.equal(fresh.stale, false);
  assert.equal(fresh.updatedAt, concurrent.updatedAt);
  const tournament = makeTournament();
  const final = tournament.matches.find((m) => m.id === "siamese-r3-0");
  final.scores = [{ songId: "special:旧曲名", a: 123, b: 456 }];
  let publicData = await publicSongCatalog(tournament);
  assert.equal(Object.keys(publicData.catalog).length, 36);
  assert.ok(!JSON.stringify(publicData).includes("未公开指定曲"));
  final.published = true;
  const hydrated = hydrateTournament(tournament);
  assert.deepEqual(hydrated.matches.find((m) => m.id === final.id).scores, [{ songId: "special:siamese:final", a: 123, b: 456 }]);
  publicData = await publicSongCatalog(hydrated);
  assert.equal(publicData.catalog["special:siamese:final"].title, "未公开指定曲");
  Date.now = () => originalNow() + 31_000;
  rows[0].song_name = "更新后的曲名";
  rows[0].level_4 = 9;
  publicData = await publicSongCatalog(hydrated);
  assert.equal(publicData.catalog["siamese-4"].title, "更新后的曲名");
  assert.equal(publicData.catalog["siamese-4"].stars, 9);
  Date.now = () => originalNow() + 62_000;
  globalThis.fetch = async () => { throw new Error("offline"); };
  const stale = await publicSongCatalog(hydrated);
  assert.equal(stale.stale, true);
  assert.deepEqual(stale.catalog, publicData.catalog);
  console.log("PASS request coalescing, live refresh, stale fallback, unpublished designated song privacy and legacy score preservation");

  final.a = tournament.matches[0].a;
  final.b = tournament.matches[1].a;
  assert.throws(() => applyAction(tournament, final.id, { type: "draft", scores: [{ songId: "special:任意伪造曲目", a: null, b: null }] }), /曲目/);
  assert.doesNotThrow(() => applyAction(tournament, final.id, { type: "draft", scores: [{ songId: designatedId("siamese", 3), a: null, b: null }] }));
  console.log("PASS designated chart identity checked independently of metadata API availability");
} finally {
  globalThis.fetch = originalFetch;
  Date.now = originalNow;
  await rm(dir, { recursive: true, force: true });
}
