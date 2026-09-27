import type { SongCatalog } from "./songs";
import { totals, type GroupId, type Match, type Player, type Tournament } from "./tournament";

export type SongStanding = {
  id: string;
  selections: number;
  bans: number;
  plays: number;
  rank: number;
  banRank: number;
  leaders: { player: Player; score: number; match: Match; rank: number }[];
};
export type MatchStanding = { match: Match; margin: number; ratingGap: number };

export function groupChampions(tournament: Tournament) {
  return (["ragdoll", "tabby", "siamese"] as const).map(group => {
    const final = tournament.matches.find(match => match.group === group && match.round === 3 && match.published &&
      (match.status === "complete" || match.status === "bye"));
    const winner = final ? [final.a, final.b].find(player => player && player.id === final.winner) : null;
    return { group, winner: winner ?? null, match: winner ? final! : null };
  });
}

export function summarizeGroup(tournament: Tournament, group: GroupId, catalog: SongCatalog, pool: string[]) {
  // Statistics must remain safe even if called with an administrator's snapshot.
  const matches = tournament.matches.filter(m => m.group === group && m.published && m.status === "complete" &&
    m.a && m.b && (m.winner === m.a.id || m.winner === m.b.id) && m.scores.length > 0 &&
    m.scores.every(s => s.a !== null && s.b !== null && Number.isFinite(s.a) && Number.isFinite(s.b)));
  const songs = new Map<string, SongStanding>();
  const chartKey = (id: string) => catalog[id] ? `${catalog[id].songID}:${catalog[id].difficultyIndex}` : id;
  const ensureSong = (id: string) => {
    const key = chartKey(id);
    let song = songs.get(key);
    if (!song) {
      song = { id, selections: 0, bans: 0, plays: 0, rank: 0, banRank: 0, leaders: [] };
      songs.set(key, song);
    }
    return song;
  };
  // Only publicly supplied pool IDs are included; unrevealed designated charts
  // must never be inferred from private catalog entries or future rounds.
  pool.forEach(ensureSong);
  for (const match of matches) {
    for (const id of match.picks.flat()) ensureSong(id).selections++;
    for (const id of match.bans.filter(Boolean)) ensureSong(id).bans++;
    const played = new Set<SongStanding>();
    for (const row of match.scores) {
      const song = ensureSong(row.songId);
      if (!played.has(song)) song.plays++;
      played.add(song);
      for (const side of ["a", "b"] as const) {
        const player = match[side]!;
        const score = row[side]!;
        const previous = song.leaders.find(entry => entry.player.id === player.id);
        if (!previous) song.leaders.push({ player, score, match, rank: 0 });
        else if (score > previous.score) Object.assign(previous, { player, score, match });
      }
    }
  }
  const rankedSongs = [...songs.values()].sort((a, b) => b.selections - a.selections || a.id.localeCompare(b.id, "en", { numeric: true }));
  rankedSongs.forEach((song, index) => {
    song.rank = index > 0 && song.selections === rankedSongs[index - 1].selections ? rankedSongs[index - 1].rank : index + 1;
    song.leaders.sort((a, b) => b.score - a.score || a.player.seed - b.player.seed || a.player.id.localeCompare(b.player.id));
    song.leaders.forEach((entry, i) => { entry.rank = i > 0 && entry.score === song.leaders[i - 1].score ? song.leaders[i - 1].rank : i + 1; });
  });
  const bannedSongs = [...rankedSongs].sort((a, b) => b.bans - a.bans || a.id.localeCompare(b.id, "en", { numeric: true }));
  bannedSongs.forEach((song, index) => {
    song.banRank = index > 0 && song.bans === bannedSongs[index - 1].bans ? bannedSongs[index - 1].banRank : index + 1;
  });
  const results: MatchStanding[] = matches.map(match => ({
    match,
    margin: Math.abs(totals(match)[0] - totals(match)[1]),
    ratingGap: Math.abs(Math.round(match.a!.rating * 100) - Math.round(match.b!.rating * 100)),
  }));
  const upsets = results.filter(({ match, ratingGap }) => {
    if (!Number.isFinite(ratingGap) || !ratingGap) return false;
    const lower = match.a!.rating < match.b!.rating ? match.a! : match.b!;
    return match.winner === lower.id;
  }).sort((a, b) => b.ratingGap - a.ratingGap || a.match.id.localeCompare(b.match.id));
  return {
    completed: matches.length,
    songs: rankedSongs,
    bannedSongs,
    upsets: upsets.filter(result => result.ratingGap === upsets[0]?.ratingGap),
    closeMatches: results.filter(result => result.margin < 2000).sort((a, b) => a.margin - b.margin || a.match.id.localeCompare(b.match.id)),
  };
}
