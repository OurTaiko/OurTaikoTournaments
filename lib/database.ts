export interface PreparedQuery {
  bind(...values: (string | number | null)[]): PreparedQuery;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<{ meta: { changes: number } }>;
}
export interface SqlDatabase { prepare(sql: string): PreparedQuery }
export type TournamentRow = { id: string; revision: number; body: string };
export type TournamentBackup = TournamentRow & { tournamentId: string; createdAt: string; actor: string };
export type SessionRow = { id: string; body: string; expires: number };
export type AdminBinding = { username: string; subject: string; issuer: string };
export interface Database {
  getSongLibrary(id: string): Promise<SongLibrary | null>;
  createSongLibrary(library: SongLibrary): Promise<void>;
  ping(): Promise<void>;
  getTournament(id: string): Promise<TournamentRow | null>;
  createTournament(row: TournamentRow): Promise<void>;
  updateTournament(row: TournamentRow, previous: number): Promise<boolean>;
  saveTournamentBackup(row: TournamentBackup): Promise<void>;
  saveSession(row: SessionRow): Promise<void>;
  getSession(id: string, now: number): Promise<SessionRow | null>;
  deleteSession(id: string): Promise<boolean>;
  bindAdmin(binding: AdminBinding): Promise<void>;
  hasAdmin(names: string[], issuer: string, subject: string): Promise<boolean>;
}
import type { SongLibrary } from './song-library';
