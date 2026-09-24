import 'server-only';
import { designatedId, parseSongMetadata, resolveSong, type SongCatalog, type SongPools } from "./songs";
import { readSongLibrary } from './song-library.server';
import type { SongLibrary } from './song-library';
import type { Match, Tournament } from "./tournament";

const SOURCE = "https://cdn.ourtaiko.org/api/cnsongs";
let cached: { metadata: ReturnType<typeof parseSongMetadata>; updatedAt: string; until: number } | undefined;
let pending: ReturnType<typeof fetchMetadata> | undefined;

async function fetchMetadata() {
  try {
    const response = await fetch(SOURCE, { cache: "no-store", signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error(`Song API HTTP ${response.status}`);
    const metadata = parseSongMetadata(await response.json());
    cached = { metadata, updatedAt: new Date().toISOString(), until: Date.now() + 30_000 };
    return { ...cached, stale: false };
  } catch {
    return { metadata: cached?.metadata ?? new Map<number, Record<string, unknown>>(), updatedAt: cached?.updatedAt ?? null, stale: true };
  }
}

export async function songMetadata() {
  if (cached && Date.now() < cached.until) return { ...cached, stale: false };
  if (!pending) pending = fetchMetadata().finally(() => { pending = undefined; });
  return pending;
}

export function designatedSong(match: Match, metadata: Awaited<ReturnType<typeof songMetadata>>["metadata"], library: SongLibrary) {
  const id = designatedId(match.group, match.round);
  return id ? resolveSong(id, library.designated[match.group][match.round === 3 ? "final" : "third"], metadata) : null;
}

export async function publicSongCatalog(tournament: Tournament) {
  const [library, state] = await Promise.all([readSongLibrary(), songMetadata()]);
  const pools = Object.fromEntries(Object.entries(library.pools).map(([group, rows]) => [group, rows.map(row => row.id)])) as SongPools;
  const catalog: SongCatalog = Object.fromEntries(Object.values(library.pools).flat()
    .map((ref) => [ref.id, resolveSong(ref.id, ref, state.metadata)]));
  for (const match of tournament.matches) {
    if (!match.published || !match.scores.some((score) => score.songId.startsWith("special:"))) continue;
    const song = designatedSong(match, state.metadata, library);
    if (song) catalog[song.id] = song;
  }
  return { catalog, pools, updatedAt: state.updatedAt, stale: state.stale,
    incomplete: Object.values(catalog).some((song) => song.stars === null) };
}
