import { z } from 'zod';
import { CL_SONG_COUNT, clDesignatedKeys } from './centurylink';

const reference = z.object({
  songID: z.number().int().positive().safe(),
  difficultyIndex: z.number().int().min(1).max(5),
}).strict();
export const centuryLinkSongLibrarySchema = z.object({
  id: z.string().min(1),
  version: z.literal(1),
  format: z.literal('centurylink'),
  songs: z.array(reference.extend({ id: z.string() })).length(CL_SONG_COUNT).refine(
    rows => rows.every((row, index) => row.id === `cl-${index + 1}`),
    'Song IDs must preserve the organiser numbering',
  ),
  designated: z.object(Object.fromEntries(clDesignatedKeys.map(key => [key, reference])) as
    Record<(typeof clDesignatedKeys)[number], typeof reference>).strict(),
}).strict();
export type CenturyLinkSongLibrary = z.infer<typeof centuryLinkSongLibrarySchema>;

export function parseCenturyLinkSongLibrary(input: unknown): CenturyLinkSongLibrary {
  const result = centuryLinkSongLibrarySchema.safeParse(input);
  // Never include private song values in logs or error responses.
  if (!result.success) throw new Error('Invalid song library configuration');
  return result.data;
}

// Public sample data only. These selections are unrelated to the real event.
export function demoCenturyLinkSongLibrary(id: string): CenturyLinkSongLibrary {
  return {
    id, version: 1, format: 'centurylink',
    songs: Array.from({ length: CL_SONG_COUNT }, (_, index) => ({ id: `cl-${index + 1}`, songID: index + 1, difficultyIndex: 4 })),
    designated: Object.fromEntries(clDesignatedKeys.map((key, index) => [key, { songID: 33 + index, difficultyIndex: 4 }])) as CenturyLinkSongLibrary['designated'],
  };
}
