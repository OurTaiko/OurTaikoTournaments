export interface PreparedQuery {
  bind(...values: (string | number | null)[]): PreparedQuery;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<{ meta: { changes: number } }>;
}
export interface SqlDatabase { prepare(sql: string): PreparedQuery }
// Compatibility DTO for rules/SQLite. Atlas stores native split documents, never this body string.
export type TournamentRow = { id: string; revision: number; body: string };
export type TournamentBackup = TournamentRow & { tournamentId: string; createdAt: string; actor: string };
export type SessionRow = { id: string; body: string; expires: number };
export interface Database {
  getSongLibrary(id: string): Promise<StoredSongLibrary | null>;
  createSongLibrary(library: StoredSongLibrary): Promise<void>;
  ping(): Promise<void>;
  getTournament(id: string): Promise<TournamentRow | null>;
  createTournament(row: TournamentRow): Promise<void>;
  updateTournament(row: TournamentRow, previous: number): Promise<boolean>;
  updateTournamentWithBackup?(row: TournamentRow, previous: number, backup: TournamentBackup): Promise<boolean>;
  saveTournamentBackup(row: TournamentBackup): Promise<void>;
  saveSession(row: SessionRow): Promise<void>;
  getSession(id: string, now: number): Promise<SessionRow | null>;
  deleteSession(id: string): Promise<boolean>;
}
import type { SongLibrary } from './song-library';
import type { CenturyLinkSongLibrary } from './centurylink-song-library';
export type StoredSongLibrary = SongLibrary | CenturyLinkSongLibrary;
