/**
 * CenturyLink (世纪汇店赛) main stage: ranking round, then an 8-player
 * double-elimination bracket in three stages. Client-safe: no private songs.
 */
export type ClSongScore = { songId: string; a: number | null; b: number | null };
export type ClPlayer = { id: string; name: string; rankingScore: number | null };
export type ClStage = 1 | 2 | 3;
export type ClMatch = {
  // Changed matches use the new tournament revision; see stampClRevisions.
  revision?: number;
  id: string;
  group: "main";
  /** Stage number (1 = 第一阶段, 2 = 第二阶段, 3 = 决赛阶段). */
  round: ClStage;
  index: number;
  a: string | null;
  b: string | null;
  status: "pending" | "live" | "complete" | "bye";
  winner: string | null;
  station: string;
  published: boolean;
  bans: [string[], string[]];
  picks: [string[], string[]];
  scores: ClSongScore[];
  updatedAt: string | null;
};
export type ClRanking = {
  status: "pending" | "live" | "complete";
  /** Player IDs ordered by seed once the ranking round is confirmed. */
  seeds: string[];
  updatedAt: string | null;
};
export type CenturyLink = {
  format: "centurylink";
  revision: number;
  updatedAt: string;
  players: ClPlayer[];
  ranking: ClRanking;
  matches: ClMatch[];
};

export const CL_PLAYER_COUNT = 8;
export type ClKind = "pickban" | "designated" | "points";
type Source = { seed: number } | { winner: string } | { loser: string };
export type ClSlotDefinition = {
  id: string;
  round: ClStage;
  kind: ClKind;
  title: string;
  a: Source;
  b: Source;
  /** Final placing of the loser, when the loss eliminates the player. */
  eliminates?: string;
};
export const clBracket: readonly ClSlotDefinition[] = [
  { id: "G1", round: 1, kind: "pickban", title: "首轮", a: { seed: 1 }, b: { seed: 8 } },
  { id: "G2", round: 1, kind: "pickban", title: "首轮", a: { seed: 2 }, b: { seed: 7 } },
  { id: "G3", round: 1, kind: "pickban", title: "首轮", a: { seed: 3 }, b: { seed: 6 } },
  { id: "G4", round: 1, kind: "pickban", title: "首轮", a: { seed: 4 }, b: { seed: 5 } },
  { id: "G5", round: 1, kind: "pickban", title: "0-1 组", a: { loser: "G1" }, b: { loser: "G4" }, eliminates: "第 7–8 名" },
  { id: "G6", round: 1, kind: "pickban", title: "0-1 组", a: { loser: "G2" }, b: { loser: "G3" }, eliminates: "第 7–8 名" },
  { id: "G7", round: 2, kind: "designated", title: "1-0 组", a: { winner: "G1" }, b: { winner: "G4" } },
  { id: "G8", round: 2, kind: "designated", title: "1-0 组", a: { winner: "G2" }, b: { winner: "G3" } },
  { id: "G9", round: 2, kind: "designated", title: "1-1 组", a: { winner: "G5" }, b: { loser: "G8" }, eliminates: "第 5–6 名" },
  { id: "G10", round: 2, kind: "designated", title: "1-1 组", a: { winner: "G6" }, b: { loser: "G7" }, eliminates: "第 5–6 名" },
  { id: "G11", round: 2, kind: "designated", title: "殿军赛", a: { winner: "G9" }, b: { winner: "G10" }, eliminates: "第 4 名" },
  { id: "G12", round: 3, kind: "points", title: "胜者组决赛", a: { winner: "G7" }, b: { winner: "G8" } },
  { id: "G13", round: 3, kind: "points", title: "败者组决赛", a: { loser: "G12" }, b: { winner: "G11" }, eliminates: "季军" },
  { id: "G14", round: 3, kind: "points", title: "总决赛", a: { winner: "G12" }, b: { winner: "G13" }, eliminates: "亚军" },
];
export const clStages: { round: ClStage; name: string; en: string; pool: string; summary: string }[] = [
  { round: 1, name: "第一阶段", en: "8 → 6", pool: "曲 1–10", summary: "决出第 7、8 名" },
  { round: 2, name: "第二阶段", en: "6 → 3", pool: "曲 5–18", summary: "决出第 4–6 名" },
  { round: 3, name: "决赛阶段", en: "3 → 1", pool: "曲 19–32", summary: "决出冠亚季军" },
];
/** Stable internal song IDs `cl-1`…`cl-32` follow the organiser's numbering. */
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => `cl-${from + i}`);
export const clPools: Record<ClStage, string[]> = { 1: range(1, 10), 2: range(5, 18), 3: range(19, 32) };
export const CL_SONG_COUNT = 32;
export const clDesignatedKeys = ["ranking", "stage2", "fourth", "winnersFinal", "losersFinal", "grandFinal"] as const;
export type ClDesignatedKey = (typeof clDesignatedKeys)[number];
export const clDesignatedLabels: Record<ClDesignatedKey, string> = {
  ranking: "排位赛指定曲",
  stage2: "第二阶段指定曲",
  fourth: "殿军赛指定曲",
  winnersFinal: "胜者组决赛决胜曲",
  losersFinal: "败者组决赛决胜曲",
  grandFinal: "总决赛决胜曲",
};
export const clSpecialId = (key: ClDesignatedKey) => `special:${key}`;
export const isSpecial = (songId: string) => songId.startsWith("special:");

export function clDefinition(id: string) {
  const definition = clBracket.find(slot => slot.id === id);
  if (!definition) throw new Error("Unknown CenturyLink match");
  return definition;
}
/** The designated song a match uses (always for stage 2, only as a tiebreak in the final stage). */
export function clDesignatedFor(id: string): ClDesignatedKey | null {
  const definition = clDefinition(id);
  if (definition.round === 2) return id === "G11" ? "fourth" : "stage2";
  if (id === "G12") return "winnersFinal";
  if (id === "G13") return "losersFinal";
  if (id === "G14") return "grandFinal";
  return null;
}
/** Number of pool bans each side may make. The winners-bracket champion bans once more in the grand final. */
export function clBanCount(id: string, side: 0 | 1) {
  clDefinition(id);
  return id === "G14" && side === 0 ? 2 : 1;
}
export const clPickCount = (id: string) => ["pickban", "designated"].includes(clDefinition(id).kind) ? 1 : 0;
export const clDrawCount = (id: string) => clDefinition(id).kind === "points" ? 4 : 0;

export function emptyClMatch(definition: ClSlotDefinition): ClMatch {
  return {
    id: definition.id, group: "main", round: definition.round, index: Number(definition.id.slice(1)),
    a: null, b: null, status: "pending", winner: null, station: "A", published: false,
    bans: [[], []], picks: [[], []], scores: [], updatedAt: null,
  };
}
export function makeCenturyLink(players: ClPlayer[] = []): CenturyLink {
  return {
    format: "centurylink", revision: 0, updatedAt: new Date().toISOString(), players: structuredClone(players),
    ranking: { status: "pending", seeds: [], updatedAt: null },
    matches: clBracket.map(emptyClMatch),
  };
}

export function clPlayer(t: CenturyLink, id: string | null) {
  return id ? t.players.find(player => player.id === id) ?? null : null;
}
export function clSeed(t: CenturyLink, id: string | null) {
  const index = id ? t.ranking.seeds.indexOf(id) : -1;
  return index < 0 ? null : index + 1;
}
export function clTotals(m: Pick<ClMatch, "scores">): [number, number] {
  return [m.scores.reduce((n, s) => n + (s.a ?? 0), 0), m.scores.reduce((n, s) => n + (s.b ?? 0), 0)];
}
/** One point per song for the higher score; an equal score awards no point. */
export function clPoints(m: Pick<ClMatch, "scores">): [number, number] {
  let a = 0, b = 0;
  for (const s of m.scores) {
    if (s.a === null || s.b === null || s.a === s.b) continue;
    if (s.a > s.b) a++; else b++;
  }
  return [a, b];
}
/** Winner side implied by recorded scores, or null when the match cannot be decided yet. */
export function clDecision(m: Pick<ClMatch, "id" | "scores">): 0 | 1 | null {
  const complete = m.scores.length > 0 && m.scores.every(s => s.a !== null && s.b !== null);
  if (clDefinition(m.id).kind === "points") {
    // First to 3 wins; the remaining drawn songs are not played.
    const [a, b] = clPoints(m);
    if (a >= 3 || b >= 3 || (complete && m.scores.length >= 4 && a !== b)) return a > b ? 0 : 1;
    return null;
  }
  if (!complete) return null;
  const [a, b] = clTotals(m);
  return a === b ? null : a > b ? 0 : 1;
}

/**
 * Songs a player already played in this stage. Only stages 1 and 2 forbid repeats;
 * final-stage draws are returned to the pool. Designated songs are mandatory and exempt.
 */
export function clPlayedSongs(t: CenturyLink, m: ClMatch, playerId: string) {
  if (m.round === 3) return new Set<string>();
  return new Set(t.matches
    .filter(n => n.id !== m.id && n.round === m.round && n.status === "complete" && (n.a === playerId || n.b === playerId))
    .flatMap(n => n.scores.map(s => s.songId).filter(id => !isSpecial(id))));
}

/** Place winners and losers into the downstream slots defined by the bracket. */
export function clAdvance(t: CenturyLink, m: ClMatch) {
  if (!m.winner) return;
  const loser = m.a === m.winner ? m.b : m.a;
  for (const slot of clBracket) {
    const target = t.matches.find(n => n.id === slot.id)!;
    for (const side of ["a", "b"] as const) {
      const source = slot[side];
      if ("winner" in source && source.winner === m.id) target[side] = m.winner;
      if ("loser" in source && source.loser === m.id) target[side] = loser;
    }
  }
}
/** Fill first-round matches from the confirmed seeds. */
export function clSeedFirstRound(t: CenturyLink) {
  for (const slot of clBracket) {
    const target = t.matches.find(n => n.id === slot.id)!;
    for (const side of ["a", "b"] as const) {
      const source = slot[side];
      if ("seed" in source) target[side] = t.ranking.seeds[source.seed - 1] ?? null;
    }
  }
}

export type ClStanding = { place: string; playerId: string | null };
export function clStandings(t: CenturyLink): ClStanding[] {
  const find = (id: string) => t.matches.find(m => m.id === id)!;
  const loser = (id: string) => { const m = find(id); return m.winner ? (m.a === m.winner ? m.b : m.a) : null; };
  return [
    { place: "冠军", playerId: find("G14").winner },
    { place: "亚军", playerId: loser("G14") },
    { place: "季军", playerId: loser("G13") },
    { place: "第 4 名", playerId: loser("G11") },
    { place: "第 5–6 名", playerId: loser("G9") },
    { place: "第 5–6 名", playerId: loser("G10") },
    { place: "第 7–8 名", playerId: loser("G5") },
    { place: "第 7–8 名", playerId: loser("G6") },
  ];
}

/** Viewers never see unpublished drafts. Ranking scores appear once the round starts. */
export function publicCenturyLink(t: CenturyLink): CenturyLink {
  return {
    ...t,
    players: t.ranking.status === "pending" ? t.players.map(p => ({ ...p, rankingScore: null })) : t.players,
    matches: t.matches.map(m => m.published ? m : { ...m, picks: [[], []], bans: [[], []], scores: [] }),
  };
}

// Include downstream slots in conflict detection, as for HachiCats.
export function stampClRevisions(previous: CenturyLink, next: CenturyLink): CenturyLink {
  const before = new Map(previous.matches.map(match => [match.id, match]));
  for (const match of next.matches)
    if (JSON.stringify(before.get(match.id)) !== JSON.stringify(match)) match.revision = next.revision;
  return next;
}
