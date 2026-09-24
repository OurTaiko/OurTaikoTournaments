import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
const dir = await mkdtemp(tmpdir() + '/hachicats-storage-');
try {
  await build({ entryPoints: ['lib/runtime.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: dir + '/runtime.cjs' });
  const env = { ...process.env, DATABASE_PATH: dir + '/test.sqlite', MONGODB_URI: '', VERCEL: '' };
  const run = code => {
    const p = spawnSync(process.execPath, ['--input-type=module', '-e', `import runtimeModule from '${dir}/runtime.cjs'; const db=runtimeModule.runtime.DB; ${code}`], { env, encoding: 'utf8' });
    assert.equal(p.status, 0, p.stderr); return p.stdout.trim();
  };
  assert.equal(run(`await db.createTournament({id:'test',revision:0,body:'initial'}); await db.createTournament({id:'test',revision:0,body:'overwrite'}); console.log((await db.getTournament('test')).body)`), 'initial');
  assert.equal(run(`const a=await db.updateTournament({id:'test',revision:1,body:'updated'},0); const b=await db.updateTournament({id:'test',revision:1,body:'stale'},0); console.log(a,b,(await db.getTournament('test')).body)`), 'true false updated');
  assert.equal(run(`console.log((await db.getTournament('test')).body)`), 'updated');
  assert.equal(run(`await db.saveSession({id:'s',body:'session',expires:100}); console.log(!!await db.getSession('s',99), await db.getSession('s',100),await db.deleteSession('s'),await db.deleteSession('s'))`), 'true null true false');
  console.log('PASS SQLite restart persistence, non-overwriting initialization, revision CAS, expiry boundary and one-use session deletion.');
} finally { await rm(dir, { recursive: true, force: true }); }
