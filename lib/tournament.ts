import { resolvePlayer, type Rosters, type GroupId, type Player } from "./players";
export type { GroupId, Player } from "./players";
export { songName } from "./songs";
export type { Song } from "./songs";
import { designatedId } from "./songs";
export type SongScore = { songId: string; a: number | null; b: number | null };
export type Match = {
  // Legacy matches start at 0; changed matches use the new tournament revision.
  revision?: number;
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
  rosters: Rosters;
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

// Match references always resolve against the database roster.
export function hydrateTournament(stored: StoredTournament): Tournament {
  return {
    ...stored,
    matches: stored.matches.map((match) => ({
      ...match,
      a: match.a ? resolvePlayer(match.a, stored.rosters) : null,
      b: match.b ? resolvePlayer(match.b, stored.rosters) : null,
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
// Include downstream slots and hydrated player profiles in conflict detection.
export function stampMatchRevisions(previous: Tournament, next: Tournament): Tournament {
  const before = new Map(previous.matches.map(match => [match.id, match]));
  for (const match of next.matches) {
    if (JSON.stringify(before.get(match.id)) !== JSON.stringify(match)) {
      match.revision = next.revision;
    }
  }
  return next;
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
