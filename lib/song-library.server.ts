import 'server-only';
import { hachicatsScope, tournamentStorageId, type TournamentScope } from './tournament-scope';
import { db, isDemo } from './store';
import { parseSongLibrary } from './song-library';
import { demoSongLibrary } from './demo-song-library';

export async function readSongLibrary(scope: TournamentScope = hachicatsScope(isDemo())) {
  const id = tournamentStorageId(scope);
  let library = await db().getSongLibrary(id);
  if (!library && scope.demo) {
    await db().createSongLibrary(demoSongLibrary(id));
    library = await db().getSongLibrary(id);
  }
  // Production must be imported explicitly; never silently substitute sample songs.
  if (!library) throw new Error('Song library has not been configured');
  if (library.id !== id) throw new Error('Song library scope mismatch');
  return parseSongLibrary(library);
}
