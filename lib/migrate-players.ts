import { HACHICATS_TOURNAMENT_ID } from './tournaments';
import type { Database } from './database';
import { rosters } from './tournament-seed';
import { hydrateTournament } from './tournament';

// Add profiles without rewriting any historical match, score, winner or advancement.
export async function migratePlayers(db: Database, apply: boolean) {
  const current = await db.getTournament(HACHICATS_TOURNAMENT_ID);
  if (!current) throw new Error('Production tournament is missing');
  const stored = JSON.parse(current.body);
  if (stored.rosters) {
    hydrateTournament(stored);
    return { migrated: false, revision: current.revision, players: Object.values(stored.rosters).flat().length };
  }
  if (!apply) throw new Error('Players have not been migrated');
  if (stored.revision !== current.revision || !Number.isSafeInteger(current.revision) || current.revision >= Number.MAX_SAFE_INTEGER)
    throw new Error('Invalid tournament revision');
  const next = { ...stored, rosters: structuredClone(rosters), revision: current.revision + 1, updatedAt: new Date().toISOString() };
  hydrateTournament(next);
  await db.saveTournamentBackup({ ...current, id: crypto.randomUUID(), tournamentId: current.id,
    createdAt: new Date().toISOString(), actor: 'migration:database-players' });
  if (!await db.updateTournament({ id: current.id, revision: next.revision, body: JSON.stringify(next) }, current.revision))
    throw new Error('Tournament changed during migration; no data overwritten');
  const saved = await db.getTournament(current.id);
  if (!saved || saved.revision !== next.revision || saved.body !== JSON.stringify(next))
    throw new Error('Tournament changed after migration; inspect before retrying');
  return { migrated: true, revision: next.revision, players: Object.values(rosters).flat().length };
}
