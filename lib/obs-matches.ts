import { clDefinition, clPlayer, clPoints, clStages, clTotals, type CenturyLink } from "./centurylink";
import { groups, roundNames, totals, type SongScore, type Tournament } from "./tournament";

export type ObsMatch = {
  id: string;
  station: string;
  stage: string;
  title: string;
  players: [string, string];
  totals: [number | null, number | null];
  scoreLabel: string;
  scores: SongScore[];
};

/** Only published, ongoing matches may appear in the broadcast overlay. */
export function obsMatches(tournament: Tournament | CenturyLink): ObsMatch[] {
  const matches: ObsMatch[] = "format" in tournament
    ? tournament.matches.filter(m => m.published && m.status === "live").map(m => {
      const points = clDefinition(m.id).kind === "points";
      return {
        id: m.id, station: m.station,
        stage: clStages.find(stage => stage.round === m.round)!.name,
        title: `${m.id} · ${clDefinition(m.id).title}`,
        players: [clPlayer(tournament, m.a)?.name ?? "待定", clPlayer(tournament, m.b)?.name ?? "待定"],
        totals: points ? clPoints(m) : recordedTotals(m.scores, clTotals(m)),
        scoreLabel: points ? "胜曲数 · 先得 3 分" : "当前总分",
        scores: m.scores,
      };
    })
    : tournament.matches.filter(m => m.published && m.status === "live").map(m => ({
      id: m.id, station: m.station,
      stage: groups.find(group => group.id === m.group)!.name,
      title: `${roundNames[m.round]} · 第 ${m.index + 1} 场`,
      players: [m.a?.name ?? "待定", m.b?.name ?? "待定"],
      totals: recordedTotals(m.scores, totals(m)),
      scoreLabel: "当前总分", scores: m.scores,
    }));
  return matches.sort((a, b) => a.station.localeCompare(b.station, "en", { numeric: true }) || a.id.localeCompare(b.id, "en", { numeric: true }));
}

function recordedTotals(scores: SongScore[], totals: [number, number]): [number | null, number | null] {
  return [scores.some(s => s.a !== null) ? totals[0] : null, scores.some(s => s.b !== null) ? totals[1] : null];
}
