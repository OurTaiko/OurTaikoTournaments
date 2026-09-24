import { z } from 'zod';

const reference = z.object({
  songID: z.number().int().positive().safe(),
  difficultyIndex: z.number().int().min(1).max(5),
}).strict();
const entry = reference.extend({ id: z.string() });
const pool = (group: string) => z.array(entry).length(12).refine(
  rows => rows.every((row, index) => row.id === `${group}-${index + 1}`),
  'Pool IDs must preserve their ordered tournament references',
);
const designated = z.object({ final: reference, third: reference }).strict();
export const songLibrarySchema = z.object({
  id: z.string().min(1),
  version: z.literal(1),
  pools: z.object({ siamese: pool('siamese'), tabby: pool('tabby'), ragdoll: pool('ragdoll') }).strict(),
  designated: z.object({ siamese: designated, tabby: designated, ragdoll: designated }).strict(),
}).strict();
export type SongLibrary = z.infer<typeof songLibrarySchema>;

export function parseSongLibrary(input: unknown): SongLibrary {
  const result = songLibrarySchema.safeParse(input);
  // Never include private song values in logs or error responses.
  if (!result.success) throw new Error('Invalid song library configuration');
  return result.data;
}
