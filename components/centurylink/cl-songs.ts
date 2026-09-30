import { difficultyNames, type SongCatalog } from "@/lib/songs";

export function clSongName(id: string, catalog: SongCatalog) {
  const song = catalog[id];
  if (!song) return "曲目信息加载中";
  return `${song.title}${song.difficultyIndex === 4 ? "" : `（${difficultyNames[song.difficultyIndex]}）`}`;
}
/** Organiser numbering: `cl-7` is 曲 7. */
export const clSongNumber = (id: string) => Number(id.slice(3));
/** OurTaiko wiki page for a chart's song. */
export const songWikiUrl = (songID: number) => `https://wiki.ourtaiko.org/songs/${songID}`;
