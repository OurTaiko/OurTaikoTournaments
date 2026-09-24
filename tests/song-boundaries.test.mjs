import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { existsSync } from 'node:fs';

const result = await build({ entryPoints: ['app/page.tsx'], bundle: true, platform: 'browser', write: false, metafile: true, logLevel: 'silent' });
const forbidden = Object.keys(result.metafile.inputs).filter(path =>
  /(?:^|\/)lib\/(?:.*\.server|runtime(?:\.cloudflare)?|mongodb|sql-database|demo-song-library|song-library)\.ts$/.test(path) ||
  /(?:^|\/)data\/(?:songs|designated-songs)\.json$/.test(path) ||
  path.includes('node_modules/server-only/'),
);
assert.deepEqual(forbidden, [], 'Browser graph must not contain database, private-library or demo seed modules');
assert.equal(existsSync('data/songs.json'), false, 'Real event song references must not be restored to source');
assert.equal(existsSync('data/designated-songs.json'), false, 'Real designated songs must not be restored to source');
console.log('PASS browser dependency graph excludes database readers, private libraries and sample seeds; retired source JSON is absent.');
