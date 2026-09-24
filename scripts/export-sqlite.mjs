import { DatabaseSync } from 'node:sqlite';
import { writeFileSync } from 'node:fs';
const [source, destination] = process.argv.slice(2);
if (!source || !destination) throw new Error('Usage: node scripts/export-sqlite.mjs <sqlite-file> <snapshot.json>');
const db = new DatabaseSync(source, { readOnly: true });
try {
  db.exec('BEGIN');
  const snapshot = {
    format: 'hachicats-sqlite-v1', exportedAt: new Date().toISOString(),
    tournaments: db.prepare('SELECT id, revision, body FROM tournaments').all(),
    admins: db.prepare('SELECT username, subject, issuer FROM admins').all(),
    sessions: db.prepare('SELECT id, body, expires FROM sessions WHERE expires > ?').all(Date.now()),
  };
  db.exec('COMMIT');
  writeFileSync(destination, JSON.stringify(snapshot), { mode: 0o600, flag: 'wx' });
  console.log(JSON.stringify({ tournaments: snapshot.tournaments.length, admins: snapshot.admins.length, sessions: snapshot.sessions.length }));
} finally { db.close(); }
