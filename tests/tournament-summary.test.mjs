import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
const dir = await mkdtemp(tmpdir() + '/hachicats-recap-');
try {
  await build({ entryPoints: ['lib/tournament-summary.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: dir + '/summary.cjs' });
  const { summarizeGroup, groupChampions } = (await import(dir + '/summary.cjs')).default;
  const p = (id, rating) => ({ id, name: id, rating, seed: id.charCodeAt(0) });
  const [a,b,c,d,e] = [p('A',5),p('B',9),p('C',7),p('D',4),p('E',8)];
  const song = n => `siamese-${n}`;
  const fixture = (id, a, b, winner, picks, bans, scores, extra={}) => ({ id, group:'siamese', round:0, index:0, a,b,winner, status:'complete', published:true, station:'A', updatedAt:null, picks:picks.map(side=>side.map(song)), bans:bans.map(song), scores:scores.map(([n,a,b])=>({songId:song(n),a,b})), ...extra });
  const matches = [
    fixture('m1',a,b,a.id,[[1,2],[2,3]],[2,1],[[2,10000,9000],[3,10000,9002]]),
    fixture('m2',a,c,c.id,[[1,2],[3,4]],[3,1],[[2,20000,21000],[4,10000,11000]]),
    fixture('m3',d,e,d.id,[[2,3],[2,4]],[2,2],[[3,100,0],[4,100,0]]),
    fixture('m4',a,b,a.id,[[1,3],[1,4]],[4,3],[],{round:3,scores:[{songId:'special:siamese:final',a:100,b:0},{songId:song(3),a:100,b:0},{songId:song(4),a:100,b:0}]}),
  ];
  const pool = [1,2,3,4,5].map(song);
  const catalog = Object.fromEntries(pool.map((id,i)=>[id,{id,songID:i+1,difficultyIndex:4,title:`Sample ${i+1}`,stars:8}]));
  catalog['special:siamese:final'] = {...catalog[song(1)],id:'special:siamese:final'};
  catalog['special:siamese:third'] = {id:'special:siamese:third',songID:999,difficultyIndex:5,title:'PRIVATE SENTINEL',stars:10};
  const excluded = ['pending','live','bye'].map(status=>({...structuredClone(matches[0]),id:status,status}));
  excluded.push({...structuredClone(matches[0]),id:'private',published:false,picks:[['PRIVATE_SENTINEL'],[]],scores:[{songId:'special:siamese:third',a:999,b:0}]});
  excluded.push({...structuredClone(matches[0]),id:'partial',scores:[{songId:song(2),a:50000,b:null}]});
  excluded.push({...structuredClone(matches[0]),id:'other-group',group:'tabby'});
  const tournament={matches:[...matches,...excluded],rosters:{siamese:[a,b,c,d,e],tabby:[],ragdoll:[]},revision:1,updatedAt:''};
  const before=JSON.stringify(tournament);
  const result=summarizeGroup(tournament,'siamese',catalog,pool);
  assert.equal(result.completed,4);
  assert.equal(JSON.stringify(tournament),before,'Analysis cannot mutate match data');
  assert.equal(result.songs[0].id,song(2));
  assert.equal(result.songs[0].selections,5,'Both original picks count even when banned');
  assert.equal(result.bannedSongs[0].id,song(2));
  assert.equal(result.bannedSongs[0].bans,3,'Both players banning the same song counts twice');
  assert.deepEqual(result.songs.filter(s=>s.rank===2).map(s=>s.id),[song(1),song(3)]);
  assert.deepEqual(result.songs[0].leaders.map(row=>[row.player.id,row.score]),[['C',21000],['A',20000],['B',9000]]);
  assert.equal(result.songs.find(s=>s.id===song(1)).plays,1,'Designated alias for the same chart merges into pool entry');
  assert.equal(result.songs.find(s=>s.id===song(5)).selections,0,'Unused pool songs remain visible');
  assert.equal(result.songs.find(s=>s.id===song(5)).leaders.length,0);
  assert(!JSON.stringify(result).includes('PRIVATE'),'Hidden matches and unused private catalog entries cannot leak');
  assert.deepEqual(result.upsets.map(row=>row.match.id),['m1','m3','m4'],'All largest-gap ties are retained');
  assert(result.upsets.every(row=>row.ratingGap===400));
  assert.deepEqual(result.closeMatches.map(row=>[row.match.id,row.margin]),[['m3',200],['m4',300],['m1',1998]],'Strictly less than 2000; total includes designated song');
  // An extra chart can change the total margin across the threshold.
  const extra=structuredClone(matches[0]);
  extra.scores.push({songId:song(5),a:2,b:0});
  assert.equal(summarizeGroup({...tournament,matches:[extra]},'siamese',catalog,pool).closeMatches.length,0);
  // Same scores share rank; zero is a real score, and chart difficulty remains distinct.
  const tied=structuredClone(matches[1]); tied.scores[0].a=21000;
  const tieResult=summarizeGroup({...tournament,matches:[tied]},'siamese',catalog,pool);
  assert.deepEqual(tieResult.songs.find(s=>s.id===song(2)).leaders.map(row=>row.rank),[1,1]);
  const chart=structuredClone(matches[3]); chart.scores[0].songId='special:siamese:third';
  const chartCatalog={...catalog,'special:siamese:third':{...catalog[song(1)],id:'special:siamese:third',difficultyIndex:5}};
  assert.equal(summarizeGroup({...tournament,matches:[chart]},'siamese',chartCatalog,pool).songs.length,6);
  const empty=summarizeGroup(tournament,'ragdoll',catalog,[]);
  assert.equal(empty.completed,0); assert.equal(empty.upsets.length,0); assert.equal(empty.closeMatches.length,0);
  const lowerB=structuredClone(matches[0]);
  lowerB.a.rating=9.01; lowerB.b.rating=5; lowerB.winner=lowerB.b.id;
  lowerB.scores.forEach(row=>{ [row.a,row.b]=[row.b,row.a]; });
  assert.equal(summarizeGroup({...tournament,matches:[lowerB]},'siamese',catalog,pool).upsets[0].ratingGap,401);
  lowerB.a.rating=5;
  assert.equal(summarizeGroup({...tournament,matches:[lowerB]},'siamese',catalog,pool).upsets.length,0,'Equal rating is not an upset');
  const duplicateChart=structuredClone(matches[3]);
  duplicateChart.scores.push({songId:song(1),a:120,b:0});
  const merged=summarizeGroup({...tournament,matches:[duplicateChart]},'siamese',catalog,pool).songs.find(s=>s.id===song(1));
  assert.equal(merged.plays,1,'Same chart aliases in one match count as one played match');
  assert.equal(merged.leaders.find(entry=>entry.player.id===a.id).score,120);
  const champions=groupChampions(tournament);
  assert.deepEqual(champions.map(row=>row.group),['ragdoll','tabby','siamese']);
  assert.equal(champions[0].winner,null);
  assert.equal(champions[2].winner.id,a.id);
  for(const extra of [{published:false},{status:'live'},{winner:'unknown'}]) {
    assert.equal(groupChampions({...tournament,matches:[{...matches[3],...extra}]}).every(row=>row.winner===null),true);
  }
  assert.equal(groupChampions({...tournament,matches:[{...matches[3],status:'bye'}]})[2].winner.id,a.id);
  console.log('PASS recap: original picks/bans, best score per player, tied ranks, chart identity, zeros, groups, hidden/unfinished/bye exclusion, largest upset ties, strict 2000 boundary and all-song totals.');
} finally { await rm(dir,{recursive:true,force:true}); }
