import type { Database, SqlDatabase } from './database';

// Keep the existing SQLite/D1 storage available for local demos and rollback.
export function sqlDatabase(sql: SqlDatabase): Database {
  return {
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
