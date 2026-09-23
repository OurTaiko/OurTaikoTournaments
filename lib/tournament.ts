import { rosters, resolvePlayer, type GroupId, type Player } from "./players";
export type { GroupId, Player } from "./players";
export type Song = { id: string; title: string; stars: number; ura?: boolean };
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
const rawSongs: Record<GroupId, [string, number, boolean?][]> = {
  siamese: [
    ["KOKUSHIN CHRONICLE", 7],
    ["零 -ZERO-", 7],
    ["OMOI WO TENI NEGAI WO KOMETE", 7],
    ["Angel Dream", 8],
    ["百花缭乱", 8],
    ["宇宙SAMURAI", 8],
    ["RAGING FIRE", 8],
    ["月光", 8, true],
    ["哆哆咔哆～", 8],
    ["旋风之舞【地】", 9],
    ["Wrong World", 9, true],
    ["被遗忘的提尔纳诺", 9],
  ],
  tabby: [
    ["G意识过剩", 9],
    ["No Way Back", 9, true],
    ["STAGE 0.ac11", 9],
    ["Youthful Coaster", 9],
    ["一世风靡", 9],
    ["魔导幻想曲", 9],
    ["最终鬼畜妹Frandre・S", 10],
    ["Struck Stardust", 10],
    ["Ka.Ma.Se", 10, true],
    ["Miracle Meeting", 10],
    ["The ephemeral dances in the primordial", 10],
    ["waitin’ for u", 10],
  ],
  ragdoll: [
    ["Little White Witch", 9],
    ["Heaven’s Rider", 9],
    ["卡恰咚2000", 9],
    ["IOSYS Autumn Carnivorous Festival 2014", 9],
    ["恭喜毕业典礼", 10],
    ["Chronomia", 10],
    ["Dogbite", 10],
    ["Evidence of evil", 10],
    ["Extreme End", 10],
    ["God Ray", 10],
    ["Hung-rock", 10],
    ["Soulway", 10],
  ],
};
export const songs = Object.fromEntries(
  groups.map((g) => [
    g.id,
    rawSongs[g.id].map(([title, stars, ura], i) => ({
      id: `${g.id}-${i + 1}`,
      title,
      stars,
      ura,
    })),
  ]),
) as Record<GroupId, Song[]>;
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
export function songName(group: GroupId, id: string) {
  return (
    songs[group].find((s) => s.id === id)?.title ??
    (id.startsWith("special:") ? id.slice(8) : id)
  );
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
