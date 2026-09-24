import type { SongLibrary } from './song-library';

// Public sample data only. These selections are unrelated to the real event.
export function demoSongLibrary(id = 'demo'): SongLibrary {
  const pool = (group: string) => Array.from({ length: 12 }, (_, index) => ({
    id: `${group}-${index + 1}`, songID: index + 1, difficultyIndex: 4,
  }));
  const designated = () => ({ final: { songID: 13, difficultyIndex: 4 }, third: { songID: 14, difficultyIndex: 4 } });
  return {
    id, version: 1,
    pools: { siamese: pool('siamese'), tabby: pool('tabby'), ragdoll: pool('ragdoll') },
    designated: { siamese: designated(), tabby: designated(), ragdoll: designated() },
  };
}
