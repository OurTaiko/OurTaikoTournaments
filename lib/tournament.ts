export type GroupId = "siamese" | "tabby" | "ragdoll";
export type Song = { id: string; title: string; stars: number; ura?: boolean };
export type Player = { id: string; name: string; seed: number };
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
const rosters: Record<GroupId, string[]> = {
  siamese: [
    "Andywyl",
    "遗沙",
    "Aimyon",
    "菜坤yyd",
    "hty",
    "盐汽水",
    "AKIRO",
    "眩晕群星",
    "卡卡",
    "句号",
    "FORRRRRCE",
    "蛋挞汽水",
    "榕",
    "栗子",
    "丰川祥子",
    "安东",
  ],
  tabby: [
    "6Lwater",
    "薄利零梦",
    "bebenk",
    "传奇牢机长",
    "泥歌咚",
    "子和",
    "Husky",
    "煎饼狗子",
    "小新",
    "磁光",
    "97",
    "君子橙",
    "杏",
    "Tnxn",
    "洛天依",
    "五条闲",
  ],
  ragdoll: [
    "oLaf",
    "五元",
    "Buttercake",
    "好丽友",
    "dbruce",
    "社畜桑",
    "pkdkar",
    "孫咲钏",
    "露露",
    "红豆麻薯派",
    "WY_Keith",
    "阿紫",
    "xs",
    "路人咚",
    "yzj",
    "阿双",
  ],
};
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
          a:
            r === 0
              ? {
                id: `${g.id}-p${i * 2}`,
                name: rosters[g.id][i * 2],
                seed: i * 2 + 1,
              }
              : null,
          b:
            r === 0
              ? {
                id: `${g.id}-p${i * 2 + 1}`,
                name: rosters[g.id][i * 2 + 1],
                seed: i * 2 + 2,
              }
              : null,
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
