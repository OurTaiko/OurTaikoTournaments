import type { GroupId } from "./players";
import type { SongRef } from "./songs";
import designatedData from "../data/designated-songs.json";
// Never import this module into a client component. Reveal only with a published match.
export const designated: Record<GroupId, { final: SongRef; third: SongRef }> = designatedData;
