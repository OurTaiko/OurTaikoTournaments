import 'server-only';
import { tournamentStorageId, type TournamentScope } from './tournament-scope';
import { db, runtime } from './store';
import { RuleError } from './rules';
import { validateCenturyLink } from './tournament-documents';
import { demoCenturyLinkSongLibrary, parseCenturyLinkSongLibrary, type CenturyLinkSongLibrary } from './centurylink-song-library';
import { songMetadata } from './song-catalog.server';
import { resolveSong, type SongCatalog } from './songs';
import {
  clDesignatedFor, clDesignatedKeys, clPools, clSpecialId, makeCenturyLink,
  type CenturyLink, type ClDesignatedKey, type ClMatch,
} from './centurylink';

/** Public sample roster for local demos only. */
const demoPlayers = ['鼓王', '咚咚', '咔咔', '连打怪', '里谱面', '满连', '良率', '鼓棒'].map((name, index) => ({
  id: `cl-demo-${index + 1}`, name, rankingScore: null,
}));

export async function readCenturyLink(scope: TournamentScope): Promise<CenturyLink> {
  const id = tournamentStorageId(scope);
  let row = await db().getTournament(id);
  if (!row) {
    // Production must be provisioned explicitly; never create it from a request by accident.
    if (runtime.MONGODB_URI && !scope.demo)
      throw new Error('Production tournament must be initialized before serving requests');
    await db().createTournament({ id, revision: 0, body: JSON.stringify(makeCenturyLink(scope.demo ? demoPlayers : [])) });
    row = await db().getTournament(id);
  }
  return validateCenturyLink(JSON.parse(row!.body), row!.revision);
}

export async function writeCenturyLink(next: CenturyLink, previous: number, scope: TournamentScope) {
  const updated = await db().updateTournament({ id: tournamentStorageId(scope), revision: next.revision, body: JSON.stringify(next) }, previous);
  if (!updated) throw new RuleError('赛况刚被另一位工作人员更新，请刷新后重试。', 409);
}

export async function readCenturyLinkSongLibrary(scope: TournamentScope): Promise<CenturyLinkSongLibrary> {
  const id = tournamentStorageId(scope);
  let library = await db().getSongLibrary(id);
  if (!library && scope.demo) {
    await db().createSongLibrary(demoCenturyLinkSongLibrary(id));
    library = await db().getSongLibrary(id);
  }
  if (!library) throw new Error('Song library has not been configured');
  if (library.id !== id) throw new Error('Song library scope mismatch');
  return parseCenturyLinkSongLibrary(library);
}

type Metadata = Awaited<ReturnType<typeof songMetadata>>['metadata'];
const designatedSong = (library: CenturyLinkSongLibrary, key: ClDesignatedKey, metadata: Metadata) =>
  resolveSong(clSpecialId(key), library.designated[key], metadata);

/** Designated songs are public only after the ranking round starts or a published match uses them. */
export function revealedDesignated(t: CenturyLink): Set<ClDesignatedKey> {
  const revealed = new Set<ClDesignatedKey>();
  if (t.ranking.status !== 'pending') revealed.add('ranking');
  for (const m of t.matches)
    if (m.published) for (const s of m.scores) {
      const key = clDesignatedKeys.find(k => clSpecialId(k) === s.songId);
      if (key) revealed.add(key);
    }
  return revealed;
}

export async function publicCenturyLinkCatalog(t: CenturyLink, scope: TournamentScope) {
  const [library, state] = await Promise.all([readCenturyLinkSongLibrary(scope), songMetadata()]);
  const catalog: SongCatalog = Object.fromEntries(library.songs.map(ref => [ref.id, resolveSong(ref.id, ref, state.metadata)]));
  for (const key of revealedDesignated(t)) catalog[clSpecialId(key)] = designatedSong(library, key, state.metadata);
  return { catalog, pools: clPools, updatedAt: state.updatedAt, stale: state.stale,
    incomplete: Object.values(catalog).some(song => song.stars === null) };
}

/** Admin-only: the match's designated song, if any, before it is announced. */
export async function adminMatchSongs(match: ClMatch, scope: TournamentScope) {
  const [library, { metadata }] = await Promise.all([readCenturyLinkSongLibrary(scope), songMetadata()]);
  const key = clDesignatedFor(match.id);
  return {
    pool: clPools[match.round].map(id => resolveSong(id, library.songs.find(song => song.id === id)!, metadata)),
    designated: key ? designatedSong(library, key, metadata) : null,
  };
}
