import seedRosters from "../data/players.json";
import type { Rosters } from "./players";
import { groups, advance, type Match, type Tournament } from "./tournament";
export const rosters: Rosters = seedRosters;
export function makeTournament(demo = false, roster: Rosters = seedRosters): Tournament {
  const matches: Match[] = [];
  for (const g of groups)
    for (let r = 0; r < 5; r++)
      for (let i = 0; i < (r === 4 ? 1 : 8 / 2 ** r); i++)
        matches.push({
          id: `${g.id}-r${r}-${i}`,
          group: g.id,
          round: r,
          index: i,
          a: r === 0 ? { ...roster[g.id][i * 2] } : null,
          b: r === 0 ? { ...roster[g.id][i * 2 + 1] } : null,
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
  return { rosters: structuredClone(roster), revision: 0, updatedAt: new Date().toISOString(), matches };
}
