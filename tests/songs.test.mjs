import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';

const dir = await mkdtemp(tmpdir() + '/hachicats-songs-');
Object.assign(process.env, { DATABASE_PATH: dir + '/test.sqlite', MONGODB_URI: '', VERCEL: '', DEMO_MODE: 'false', APP_ORIGIN: 'http://127.0.0.1:5192' });
const originalFetch = globalThis.fetch;
const originalNow = Date.now;
try {
  await build({
    stdin: { contents: `export * from './lib/songs'; export * from './lib/song-catalog.server'; export * from './lib/song-library.server'; export * from './lib/song-library'; export * from './lib/demo-song-library'; export * from './lib/tournament'; export * from './lib/rules'; export {runtime} from './lib/runtime'; export {GET as songGET} from './app/api/songs/route'; export {GET as matchGET, POST as matchPOST} from './app/api/matches/[id]/route';`, resolveDir: process.cwd() },
    bundle: true, platform: 'node', format: 'cjs', conditions: ['react-server'], outfile: dir + '/test.cjs',
  });
  const { parseSongMetadata, resolveSong, songName, designatedId, publicSongCatalog, songMetadata, makeTournament, hydrateTournament, tournamentState, applyAction, runtime, readSongLibrary, parseSongLibrary, demoSongLibrary, songGET, matchGET, matchPOST } = (await import(dir + '/test.cjs')).default;
  const db = runtime.DB;
  await assert.rejects(readSongLibrary(), /not been configured/);
  assert.equal(await db.getSongLibrary('edition-1'), null, 'Missing production library must not generate sample selections');
  process.env.DEMO_MODE = 'true';
  const demo = await readSongLibrary();
  assert.equal(demo.id, 'demo');
  assert.deepEqual(await db.getSongLibrary('demo'), demo, 'Demo samples must be persisted');
  const library = demoSongLibrary('edition-1');
  for (const [i, group] of ['siamese', 'tabby', 'ragdoll'].entries()) {
    library.designated[group] = { final: { songID: 900001 + 2*i, difficultyIndex: 5 }, third: { songID: 900002 + 2*i, difficultyIndex: 4 } };
  }
  await db.createSongLibrary(library);
  await db.createSongLibrary(demoSongLibrary('edition-1'));
  assert.deepEqual(await db.getSongLibrary('edition-1'), library, 'Initialization cannot overwrite real selections');
  process.env.DEMO_MODE = 'false';
  assert.deepEqual(await readSongLibrary(), library);
  for (const bad of [null, {}, { ...library, version: 2 }]) assert.throws(() => parseSongLibrary(bad));
  for (const difficultyIndex of [0, 6, 1.5]) {
    const bad = structuredClone(library); bad.designated.siamese.final.difficultyIndex = difficultyIndex;
    assert.throws(() => parseSongLibrary(bad), /Invalid song library/);
  }
  const rows = [
    ...Array.from({length:14}, (_, i) => ({id:i+1, song_name:`Sample song ${i+1}`, level_1:1, level_2:2, level_3:3, level_4:4, level_5:5})),
    ...Array.from({length:6}, (_, i) => ({id:900001+i, song_name:`PRIVATE SENTINEL ${i}`, level_4:9, level_5:10})),
  ];
  const metadata = parseSongMetadata(rows);
  for (let difficultyIndex=1; difficultyIndex<=5; difficultyIndex++) assert.equal(resolveSong('test', {songID:1,difficultyIndex},metadata).stars,difficultyIndex);
  assert.equal(resolveSong('test', {songID:999999,difficultyIndex:4},metadata).stars,null);
  assert.equal(songName('siamese','test',{test:resolveSong('test',{songID:1,difficultyIndex:5},metadata)}),'Sample song 1（里谱面）');
  assert.throws(() => parseSongMetadata([]));
  let calls=0;
  globalThis.fetch=async()=>{ calls++; throw Error('offline'); };
  const offline=await publicSongCatalog(makeTournament());
  assert.equal(offline.stale,true); assert.equal(offline.updatedAt,null);
  assert.equal(Object.keys(offline.catalog).length,36); assert.equal(offline.catalog['siamese-1'].stars,null);
  globalThis.fetch=async(url,options)=>{ calls++; assert.equal(url,'https://cdn.ourtaiko.org/api/cnsongs'); assert.equal(options.cache,'no-store'); return Response.json(rows); };
  const [fresh,concurrent]=await Promise.all([songMetadata(),songMetadata()]);
  assert.equal(calls,2); assert.equal(fresh.updatedAt,concurrent.updatedAt);
  const tournament=makeTournament();
  const final=tournament.matches.find(m=>m.id==='siamese-r3-0');
  final.a=tournament.matches[0].a; final.b=tournament.matches[1].a;
  final.scores=[{songId:'special:legacy',a:123,b:456}];
  let publicData=await publicSongCatalog(tournament);
  assert.equal(Object.keys(publicData.catalog).length,36);
  assert.equal(publicData.pools.siamese.length,12);
  assert(!JSON.stringify(publicData).includes('PRIVATE SENTINEL'));
  assert(!JSON.stringify(publicData).includes('90000'));
  final.published=true;
  const hydrated=hydrateTournament(tournament);
  assert.equal(hydrated.matches.find(m=>m.id===final.id).scores[0].songId,'special:siamese:final');
  publicData=await publicSongCatalog(hydrated);
  assert.equal(publicData.catalog['special:siamese:final'].title,'PRIVATE SENTINEL 0');
  assert.equal(Object.keys(publicData.catalog).length,37,'Only the published match may reveal its designated song');
  assert(!JSON.stringify(publicData).includes('PRIVATE SENTINEL 1'));
  Date.now=()=>originalNow()+31000;
  rows[0].song_name='Updated sample'; rows[0].level_4=8;
  publicData=await publicSongCatalog(hydrated);
  assert.equal(publicData.catalog['siamese-1'].title,'Updated sample');
  assert.equal(publicData.catalog['siamese-1'].stars,8);
  Date.now=()=>originalNow()+62000;
  globalThis.fetch=async()=>{throw Error('offline');};
  const stale=await publicSongCatalog(hydrated);
  assert.deepEqual(stale.catalog,publicData.catalog);
  final.published=false;
  const hiddenAgain=await publicSongCatalog(tournament);
  assert.equal(Object.keys(hiddenAgain.catalog).length,36,'Metadata cache must not cache disclosure');
  assert.throws(()=>applyAction(tournament,final.id,{type:'draft',scores:[{songId:'special:forged',a:null,b:null}]},library.pools.siamese),/曲目/);
  assert.doesNotThrow(()=>applyAction(tournament,final.id,{type:'draft',scores:[{songId:designatedId('siamese',3),a:null,b:null}]},library.pools.siamese));
  assert.throws(()=>applyAction(tournament,final.id,{type:'draft',picks:[['siamese-1','siamese-2'],['siamese-3','tabby-1']]},library.pools.siamese),/本组/);
  console.log('PASS persistent libraries, non-overwrite, explicit production provisioning, five difficulties, metadata refresh/offline fallback, per-match publication and database pool validation.');

  await db.createTournament({id:'edition-1',revision:0,body:JSON.stringify(tournamentState(tournament))});
  const anon=new Request(process.env.APP_ORIGIN+'/api/matches/siamese-r3-0');
  const params={params:Promise.resolve({id:'siamese-r3-0'})};
  assert.equal((await matchGET(anon,params)).status,401);
  const response=await songGET();
  assert.equal(response.status,200); assert.equal(response.headers.get('Cache-Control'),'no-store');
  const publicText=await response.text(); assert(!publicText.includes('PRIVATE SENTINEL')); assert(!publicText.includes('90000'));
  // Isolated demo session can read only this demo match's designated song.
  const privateDemo={...library,id:'demo'};
  const sql=new DatabaseSync(process.env.DATABASE_PATH);
  sql.prepare('UPDATE song_libraries SET body=? WHERE id=?').run(JSON.stringify(privateDemo),'demo');
  process.env.DEMO_MODE='true';
  await db.createTournament({id:'demo',revision:0,body:JSON.stringify(tournamentState(tournament))});
  await db.saveSession({id:'test-admin',body:JSON.stringify({kind:'demo'}),expires:originalNow()+120000});
  const headers={Cookie:'hachicats_session=test-admin',Origin:process.env.APP_ORIGIN};
  const admin=await matchGET(new Request(anon.url,{headers}),params);
  assert.equal(admin.status,200); assert.equal(admin.headers.get('Cache-Control'),'no-store');
  const adminData=await admin.json();
  assert.equal(adminData.designated.title,'PRIVATE SENTINEL 0'); assert.equal(adminData.pool.length,12);
  assert(!JSON.stringify(adminData).includes('PRIVATE SENTINEL 1'));
  const post=await matchPOST(new Request(anon.url,{method:'POST',headers,body:JSON.stringify({type:'draft',revision:0,scores:[{songId:designatedId('siamese',3),a:null,b:null}]})}),params);
  assert.equal(post.status,200,'Offline metadata does not prevent saving the configured chart');
  const stillPrivate=await (await songGET()).text(); assert(!stillPrivate.includes('PRIVATE SENTINEL'));
  sql.prepare('UPDATE song_libraries SET body=? WHERE id=?').run('{}','demo');
  const failed=await songGET(); assert.equal(failed.status,503); assert(! (await failed.text()).includes('PRIVATE SENTINEL'));
  sql.close();
  console.log('PASS anonymous API exclusion, authenticated match-only disclosure, no-store headers, offline score save and fail-closed invalid library.');
} finally {
  globalThis.fetch=originalFetch; Date.now=originalNow;
  await rm(dir,{recursive:true,force:true});
}
