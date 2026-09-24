import type { Database, SqlDatabase } from './database';

// Keep the existing SQLite/D1 storage available for local demos and rollback.
export function sqlDatabase(sql: SqlDatabase): Database {
  const songTable = () => sql.prepare('CREATE TABLE IF NOT EXISTS song_libraries (id TEXT PRIMARY KEY NOT NULL, body TEXT NOT NULL)').run();
  return {
    async getSongLibrary(id) {
      await songTable();
      const row = await sql.prepare('SELECT body FROM song_libraries WHERE id = ?').bind(id).first<{ body: string }>();
      return row ? JSON.parse(row.body) : null;
    },
    async createSongLibrary(library) {
      await songTable();
      await sql.prepare('INSERT OR IGNORE INTO song_libraries (id, body) VALUES (?, ?)').bind(library.id, JSON.stringify(library)).run();
    },
    async saveTournamentBackup(row) {
      await sql.prepare('CREATE TABLE IF NOT EXISTS tournament_backups (id TEXT PRIMARY KEY NOT NULL, tournamentId TEXT NOT NULL, revision INTEGER NOT NULL, body TEXT NOT NULL, createdAt TEXT NOT NULL, actor TEXT NOT NULL)').run();
      await sql.prepare('INSERT INTO tournament_backups (id, tournamentId, revision, body, createdAt, actor) VALUES (?, ?, ?, ?, ?, ?)').bind(row.id, row.tournamentId, row.revision, row.body, row.createdAt, row.actor).run();
    },
    async ping() { await sql.prepare('SELECT 1 AS ok').first(); },
    getTournament: (id) => sql.prepare('SELECT id, revision, body FROM tournaments WHERE id = ?').bind(id).first(),
    async createTournament(row) {
      await sql.prepare('INSERT OR IGNORE INTO tournaments (id, revision, body) VALUES (?, ?, ?)').bind(row.id, row.revision, row.body).run();
    },
    async updateTournament(row, previous) {
      const result = await sql.prepare('UPDATE tournaments SET body = ?, revision = ? WHERE id = ? AND revision = ?').bind(row.body, row.revision, row.id, previous).run();
      return result.meta.changes > 0;
    },
    async saveSession(row) {
      await sql.prepare('INSERT INTO sessions (id, body, expires) VALUES (?, ?, ?)').bind(row.id, row.body, row.expires).run();
    },
    getSession: (id, now) => sql.prepare('SELECT id, body, expires FROM sessions WHERE id = ? AND expires > ?').bind(id, now).first(),
    async deleteSession(id) {
      return (await sql.prepare('DELETE FROM sessions WHERE id = ?').bind(id).run()).meta.changes > 0;
    },
    async bindAdmin(binding) {
      await sql.prepare('INSERT OR IGNORE INTO admins (username, subject, issuer) VALUES (?, ?, ?)').bind(binding.username, binding.subject, binding.issuer).run();
    },
    async hasAdmin(names, issuer, subject) {
      if (!names.length) return false;
      return !!await sql.prepare(`SELECT subject FROM admins WHERE username IN (${names.map(() => '?').join(',')}) AND issuer = ? AND subject = ?`).bind(...names, issuer, subject).first();
    },
  };
}
