import { rosters, resolvePlayer, type GroupId, type Player } from "./players";
export type { GroupId, Player } from "./players";
export { songs, songName } from "./songs";
export type { Song } from "./songs";
import { designatedId } from "./songs";
export type SongScore = { songId: string; a: number | null; b: number | null };
export type Match = {
  id: string;
  group: GroupId;
  round: number;
  index: number;
  a: Player | null;
  b: Player | null;
  status: "pending" | "live" | "complete" | "bye";
  winner: string | null;
  station: string;
  picks: [string[], string[]];
  bans: [string, string];
  published: boolean;
  scores: SongScore[];
  updatedAt: string | null;
};
export type Tournament = {
  revision: number;
  updatedAt: string;
  matches: Match[];
};
type PlayerRef = Pick<Player, "id" | "seed">;
export type StoredTournament = Omit<Tournament, "matches"> & {
  matches: (Omit<Match, "a" | "b"> & {
    a: PlayerRef | null;
    b: PlayerRef | null;
  })[];
};

// Old snapshots may contain names. Always resolve the current JSON profile by ID.
export function hydrateTournament(stored: StoredTournament): Tournament {
  return {
    ...stored,
    matches: stored.matches.map((match) => ({
      ...match,
      a: match.a ? resolvePlayer(match.a) : null,
      b: match.b ? resolvePlayer(match.b) : null,
      scores: match.scores.map((score) => ({
        ...score,
        songId: score.songId.startsWith("special:") && match.round >= 3
          ? designatedId(match.group, match.round)!
          : score.songId,
      })),
    })),
  };
}

export function tournamentState(tournament: Tournament): StoredTournament {
  const ref = (player: Player | null): PlayerRef | null =>
    player ? { id: player.id, seed: player.seed } : null;
  return {
    ...tournament,
    matches: tournament.matches.map((match) => ({
      ...match,
      a: ref(match.a),
      b: ref(match.b),
    })),
  };
}
export const groups: {
  id: GroupId;
  name: string;
  en: string;
  range: string;
}[] = [
    { id: "siamese", name: "暹罗组", en: "SIAMESE", range: "★ 7–9" },
    { id: "tabby", name: "狸花组", en: "TABBY", range: "★ 9–10" },
    { id: "ragdoll", name: "布偶组", en: "RAGDOLL", range: "★ 9–10" },
  ];
export const roundNames = ["16 进 8", "8 进 4", "半决赛", "决赛", "季军赛"];
export function firstAttack(m: Match): string | null {
  if (m.round > 1 || m.status === "bye" || !m.a || !m.b) return null;
  if (!Number.isFinite(m.a.rating) || !Number.isFinite(m.b.rating)) return null;
  // Ratings use two decimals; compare hundredths to keep the 0.50 boundary exact.
  const difference = Math.round(m.a.rating * 100) - Math.round(m.b.rating * 100);
  if (Math.abs(difference) < 50) return null;
  return difference < 0 ? m.a.id : m.b.id;
}
export function totals(m: Match): [number, number] {
  return [
    m.scores.reduce((n, s) => n + (s.a ?? 0), 0),
    m.scores.reduce((n, s) => n + (s.b ?? 0), 0),
  ];
}
export function makeTournament(demo = false): Tournament {
  const matches: Match[] = [];
  for (const g of groups)
    for (let r = 0; r < 5; r++)
      for (let i = 0; i < (r === 4 ? 1 : 8 / 2 ** r); i++)
        matches.push({
          id: `${g.id}-r${r}-${i}`,
          group: g.id,
          round: r,
          index: i,
          a: r === 0 ? { ...rosters[g.id][i * 2] } : null,
          b: r === 0 ? { ...rosters[g.id][i * 2 + 1] } : null,
          status: "pending",
          winner: null,
          station: "A",
          picks: [[], []],
          bans: ["", ""],
          published: false,
          scores: [],
          updatedAt: null,
        });
  if (demo) {
    for (const i of [0, 1, 2, 3]) {
      const m = matches[i];
      m.picks = [
        ["siamese-1", "siamese-4"],
        ["siamese-6", "siamese-7"],
      ];
      m.bans = ["siamese-7", "siamese-1"];
      m.published = true;
      m.scores = [
        { songId: "siamese-4", a: 1002350 + i * 130, b: 982160 + i * 150 },
        {
          songId: "siamese-6",
          a: i > 1 ? null : 993450,
          b: i > 1 ? null : 1001540,
        },
      ];
      m.status = i > 1 ? "live" : "complete";
      m.station = i === 3 ? "B" : "A";
      if (i < 2) m.winner = m.a!.id;
    }
    advance(matches, matches[0]);
    advance(matches, matches[1]);
  }
  return { revision: 0, updatedAt: new Date().toISOString(), matches };
}
export function advance(matches: Match[], m: Match) {
  if (!m.winner) return;
  const winner = m.a?.id === m.winner ? m.a : m.b;
  const loser = m.a?.id === m.winner ? m.b : m.a;
  if (m.round < 3) {
    const next = matches.find(
      (n) =>
        n.group === m.group &&
        n.round === m.round + 1 &&
        n.index === Math.floor(m.index / 2),
    )!;
    next[m.index % 2 === 0 ? "a" : "b"] = winner;
  }
  if (m.round === 2) {
    const third = matches.find((n) => n.group === m.group && n.round === 4)!;
    third[m.index === 0 ? "a" : "b"] = m.status === "bye" ? null : loser;
  }
}
export function publicTournament(t: Tournament): Tournament {
  return {
    ...t,
    matches: t.matches.map((m) =>
      m.published ? m : { ...m, picks: [[], []], bans: ["", ""], scores: [] },
    ),
  };
}
