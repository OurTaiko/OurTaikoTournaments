/** Public directory metadata. Event data and permissions stay with each tournament. */
export const HACHICATS_TOURNAMENT_ID = "hachicats-20260927";

export function tournamentApiPath(tournamentId: string) {
  const tournament = tournaments.find(event => event.id === tournamentId);
  if (!tournament) throw new Error("Unknown tournament");
  return `/api/tournaments/${encodeURIComponent(tournament.seriesSlug)}/${encodeURIComponent(tournament.edition)}`;
}

export const tournaments = [{
  id: HACHICATS_TOURNAMENT_ID,
  href: "/hachicats/20260927",
  name: "第一届八猫杯",
  series: "HachiCats",
  seriesSlug: "hachicats",
  edition: "20260927",
  date: "2026-09-27",
  displayDate: "2026 年 9 月 27 日",
  description: "暹罗、狸花、布偶，三个组别的太鼓对决。查看赛事总结、完整对阵与比赛成绩。",
}] as const;
