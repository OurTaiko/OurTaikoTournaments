/** Public directory metadata. Event data and permissions stay with each tournament. */
export function tournamentId(series: string, edition: string) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(series) || !/^[0-9]{8}$/.test(edition))
    throw new Error("Tournament path must use a series slug and YYYYMMDD edition");
  return `${series}-${edition}`;
}

export const HACHICATS_TOURNAMENT_ID = tournamentId("hachicats", "20260927");
export const CENTURYLINK_TOURNAMENT_ID = tournamentId("centurylink", "20261227");

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
}, {
  id: CENTURYLINK_TOURNAMENT_ID,
  href: "/centurylink/20261227",
  name: "第二届世纪汇单店赛",
  series: "CenturyLink",
  seriesSlug: "centurylink",
  edition: "20261227",
  date: "2026-12-27",
  displayDate: "2026 年 12 月 27 日",
  description: "8 位选手的双败淘汰正赛：排位赛定序，经第一、第二阶段，最终在决赛阶段决出冠军。",
}] as const;
