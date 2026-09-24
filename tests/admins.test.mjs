import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
const dir = await mkdtemp(tmpdir() + '/hachicats-admins-');
process.env.DATABASE_PATH = dir + '/test.sqlite';
process.env.MONGODB_URI = '';
process.env.VERCEL = '';
try {
  await build({stdin:{contents:"export * from './lib/admins'; export {runtime} from './lib/runtime';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',outfile:dir+'/test.cjs'});
  const {adminUsernames,resolveAdmin,runtime} = (await import(pathToFileURL(dir+'/test.cjs'))).default;
  const config={ADMIN_USERNAMES:' kirisamevanilla, grace0512,Touka16, grace0512 ,'};
  assert.deepEqual(adminUsernames(config),['kirisamevanilla','grace0512','Touka16']);
  assert.deepEqual(adminUsernames({ADMIN_USERNAME:'legacy'}),['legacy']);
  assert.deepEqual(adminUsernames({ADMIN_USERNAMES:'',ADMIN_USERNAME:'legacy'}),[]);
  const identity=(username,subject=username,issuer='https://sso.ourtaiko.org')=>({username,subject,issuer});
  for(const name of ['kirisamevanilla','grace0512','Touka16']) assert.equal(await resolveAdmin(runtime.DB,config,identity(name)),true);
  assert.equal(await resolveAdmin(runtime.DB,config,identity('ordinary')),false);
  assert.equal(await resolveAdmin(runtime.DB,config,identity('童话')),false);
  assert.equal(await resolveAdmin(runtime.DB,config,identity('touka16')),false);
  assert.equal(await resolveAdmin(runtime.DB,config,identity('Touka16','replacement-account')),false);
  assert.equal(await resolveAdmin(runtime.DB,config,identity('Touka16','Touka16','https://other.example')),false);
  assert.equal(await resolveAdmin(runtime.DB,{ADMIN_USERNAMES:'kirisamevanilla'},identity('Touka16')),false);
  assert.equal(await resolveAdmin(runtime.DB,{ADMIN_USERNAMES:''},identity('kirisamevanilla')),false);
  assert.equal(await resolveAdmin(runtime.DB,config,identity('Touka16')),true);

  console.log('PASS 3 admins, legacy configuration, case sensitivity, non-admin denial, immutable subject/issuer binding, removal and empty-list revocation.');
} finally { await rm(dir,{recursive:true,force:true}); }
