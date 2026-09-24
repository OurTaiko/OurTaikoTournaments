import type { GroupId } from "./players";

export type SongRef = { songID: number; difficultyIndex: number };
export type Song = SongRef & {
  id: string;
  title: string;
  stars: number | null;
};
export type SongCatalog = Record<string, Song>;
export type SongPools = Record<GroupId, string[]>;
export const emptySongPools: SongPools = { siamese: [], tabby: [], ragdoll: [] };
export const difficultyNames = ["", "简单", "普通", "困难", "魔王", "里谱面"];

export function placeholderSong(id: string, ref: SongRef): Song {
  return { ...ref, id, title: `曲目 #${ref.songID}`, stars: null };
}

export function designatedId(group: GroupId, round: number): string | null {
  return round === 3 ? `special:${group}:final` : round === 4 ? `special:${group}:third` : null;
}

export function songName(group: GroupId, id: string, catalog: SongCatalog = {}) {
  const song = catalog[id];
  if (!song) return id.startsWith("special:") ? "指定曲信息加载中" : "曲目信息加载中";
  return `${song.title}${song.difficultyIndex === 4 ? "" : `（${difficultyNames[song.difficultyIndex]}）`}`;
}

export function parseSongMetadata(input: unknown): Map<number, Record<string, unknown>> {
  if (!Array.isArray(input) || !input.length) throw new Error("Invalid song metadata response");
  const result = new Map<number, Record<string, unknown>>();
  for (const row of input) {
    if (row && typeof row === "object" && Number.isSafeInteger(row.id) &&
      typeof row.song_name === "string" && row.song_name.trim()) result.set(row.id, row);
  }
  if (!result.size) throw new Error("No valid song metadata");
  return result;
}

export function resolveSong(id: string, ref: SongRef, metadata: Map<number, Record<string, unknown>>): Song {
  const row = metadata.get(ref.songID);
  const level = row?.[`level_${ref.difficultyIndex}`];
  const stars = typeof level === "number" ? level : typeof level === "string" && /^\d+$/.test(level) ? Number(level) : null;
  return {
    ...placeholderSong(id, ref),
    title: typeof row?.song_name === "string" ? row.song_name : `曲目 #${ref.songID}`,
    stars: stars !== null && Number.isInteger(stars) && stars >= 1 && stars <= 10 ? stars : null,
  };
}
