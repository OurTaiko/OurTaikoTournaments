import assert from "node:assert/strict";
const origin = process.env.TEST_ORIGIN || "http://127.0.0.1:5188";
const tournamentPath = "/api/tournaments/hachicats/20260927";
const request = async (path, options = {}) =>
  fetch(origin + path, {
    ...options,
    headers: { Origin: origin, ...options.headers },
  });
let r = await request(tournamentPath);
assert.equal(r.status, 200);
const { tournament, demo } = await r.json();
assert.equal(demo, true, "Only run against local demo");
r = await request(tournamentPath + "/matches/tabby-r0-0");
assert.equal(r.status, 401);
r = await request(tournamentPath + "/matches/tabby-r0-0", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    type: "bye",
    winner: "tabby-p0",
    revision: tournament.revision,
  }),
});
assert.equal(r.status, 401);
r = await request("/api/auth/demo", {
  method: "POST",
  headers: { Origin: "https://untrusted.example" },
});
assert.equal(r.status, 403);
r = await request("/api/auth/demo", { method: "POST" });
assert.equal(r.status, 200);
const cookie = r.headers.get("set-cookie").split(";")[0];
assert.match(r.headers.get("set-cookie"), /HttpOnly/);
assert.match(r.headers.get("set-cookie"), /SameSite=Lax/);
try {
  r = await request(tournamentPath + "/matches/tabby-r0-0", { headers: { Cookie: cookie } });
  assert.equal(r.status, 200);
  const state = await r.json();
  r = await request(tournamentPath + "/matches/tabby-r0-0", {
    method: "POST",
    headers: { Cookie: cookie, "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "bye",
      winner: "tabby-p0",
      revision: state.revision === 0 ? 1 : state.revision - 1,
    }),
  });
  assert.equal(r.status, 409);
  const p = await (await request(tournamentPath)).json();
  assert.equal(
    p.tournament.matches.find((m) => m.id === "tabby-r0-0").status,
    "pending",
  );
  assert(
    !p.tournament.matches.some(m => !m.published && m.scores.length),
    "Unpublished designated song leaked",
  );
  console.log(
    "PASS anonymous writes denied, private match denied, cross-origin denied, HttpOnly demo session, stale revision denied, private designated songs not disclosed.",
  );
} finally {
  await request("/api/auth/logout", {
    method: "POST",
    headers: { Cookie: cookie },
  });
}
