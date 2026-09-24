import 'server-only';
import { db, isDemo } from './store';
import { parseSongLibrary } from './song-library';
import { demoSongLibrary } from './demo-song-library';

export async function readSongLibrary() {
  const id = isDemo() ? 'demo' : 'edition-1';
  let library = await db().getSongLibrary(id);
  if (!library && isDemo()) {
    await db().createSongLibrary(demoSongLibrary());
    library = await db().getSongLibrary(id);
  }
  // Production must be imported explicitly; never silently substitute sample songs.
  if (!library) throw new Error('Song library has not been configured');
  return parseSongLibrary(library);
}
