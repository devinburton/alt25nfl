import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeDogTotal,jointSamples,evaluatePair,teamResults} from '../lib/nbaDogTotalModel.js';
const now=Date.parse('2026-11-20T15:00:00Z');
const kickoff='2026-11-20T23:00:00Z';
const history=Array.from({length:10},(_,i)=>[
 {id:`a${i}`,kickoff:`2026-11-${String(19-i).padStart(2,'0')}T00:00Z`,completed:true,seasonType:2,home:'Away Dog',away:'Other A',homeScore:108+i%5,awayScore:115-i%4},
 {id:`h${i}`,kickoff:`2026-11-${String(19-i).padStart(2,'0')}T00:00Z`,completed:true,seasonType:2,home:'Home Favorite',away:'Other B',homeScore:117+i%4,awayScore:109+i%3}
]).flat();
const game={id:'test',away:'Away Dog',home:'Home Favorite',kickoff,total:230,projected:235,awaySpread:7.5,spreadBooksCount:8,booksCount:9,marketUpdatedAt:new Date(now-3600000).toISOString(),awayProfile:{restDays:2},homeProfile:{restDays:1},modelNote:'scoring form + rest'};
const research={available:true,injuries:[],unresolvedLeader:false};
const analyze=(g=game,h=history,r=research,extra={})=>analyzeDogTotal(g,h,r,{now,oddsFetchedAt:new Date(now-3600000).toISOString(),...extra});
test('chooses a researched dog spread and directional alt total with joint probability',()=>{
 const g=analyze();assert.equal(g.status,'RESEARCH');assert.equal(g.dog,'Away Dog');assert.equal(g.direction,'OVER');assert.ok(g.altSpread>g.marketSpread);assert.ok(g.altTotal<g.marketTotal);assert.ok(g.jointProbability<=Math.min(g.spreadProbability,g.totalProbability));assert.equal(g.bookPrice,null);
});
test('supports home underdogs and under totals',()=>{
 const g=analyze({...game,awaySpread:-4.5,projected:225});assert.equal(g.status,'RESEARCH');assert.equal(g.dog,'Home Favorite');assert.equal(g.direction,'UNDER');assert.ok(g.altTotal>g.marketTotal);
});
test('passes started games and stale or missing market timestamps',()=>{
 assert.equal(analyze({...game,kickoff:new Date(now-1).toISOString()}).status,'PASS');
 assert.equal(analyze({...game,marketUpdatedAt:null}).status,'PASS');
 assert.equal(analyze(game,history,research,{oddsFetchedAt:new Date(now-9*3600000).toISOString()}).status,'PASS');
});
test('excludes preseason and future results from all sample calculations',()=>{
 const rows=[...history,{...history[0],id:'future',kickoff:'2026-11-21T00:00Z'},{...history[0],id:'preseason',seasonType:1}];assert.equal(teamResults('Away Dog',rows,kickoff,30).length,10);
 assert.equal(analyze(game,history.map(g=>({...g,seasonType:1}))).status,'PASS');
});
test('passes thin samples, unavailable research, leader uncertainty, and unclear direction',()=>{
 assert.equal(analyze(game,history.slice(0,6)).status,'PASS');
 assert.equal(analyze(game,history,{...research,available:false}).status,'PASS');
 assert.equal(analyze(game,history,{...research,unresolvedLeader:true}).status,'PASS');
 assert.equal(analyze({...game,projected:230.5}).status,'PASS');
 assert.equal(analyze({...game,awaySpread:0}).status,'PASS');
});
test('shared simulation is reproducible and cushions monotonically increase joint success',()=>{
 const rows=teamResults('Away Dog',history,kickoff);const a=jointSamples(rows,-7,230),b=jointSamples(rows,-7,230);assert.deepEqual(a,b);
 const narrow=evaluatePair(a.draws,8.5,229.5,'OVER'),wide=evaluatePair(a.draws,18.5,215.5,'OVER');assert.ok(wide.jointProbability>=narrow.jointProbability);
});
test('joint model respects correlation rather than multiplying marginal hit rates',()=>{
 const rows=Array.from({length:30},(_,i)=>({margin:i-15,total:210+i*2}));const s=jointSamples(rows,0,230);assert.ok(s.rho>0);
 const result=evaluatePair(s.draws,0,230,'OVER');assert.ok(result.jointProbability>result.spreadProbability*result.totalProbability/100+3);
});
test('injury screening matches player names when ESPN omits athlete IDs',async()=>{
 const {getNbaResearch}=await import('../lib/nbaResearch.js');
 const original=globalThis.fetch;
 globalThis.fetch=async url=>({ok:true,json:async()=>String(url).endsWith('/injuries')?{timestamp:new Date().toISOString(),injuries:[{displayName:'Away Dog',injuries:[{athlete:{displayName:'Test Scorer'},status:'Questionable'}]}]}:{events:[{id:'123',competitions:[{competitors:[{team:{displayName:'Away Dog'},leaders:[{name:'pointsPerGame',leaders:[{athlete:{displayName:'Test Scorer'}}]}]},{team:{displayName:'Home Favorite'},leaders:[{name:'pointsPerGame',leaders:[{athlete:{displayName:'Home Scorer'}}]}]}]}]}]}});
 try{const report=(await getNbaResearch([game])).get('test');assert.equal(report.available,true);assert.equal(report.unresolvedLeader,true);assert.equal(report.injuries[0].player,'Test Scorer');}finally{globalThis.fetch=original;}
});
test('matches ESPN LA Clippers to sportsbook Los Angeles Clippers',()=>{
 const rows=[{id:'clippers',completed:true,seasonType:2,kickoff:'2026-11-19T00:00Z',home:'LA Clippers',away:'Other',homeScore:120,awayScore:110}];
 assert.equal(teamResults('Los Angeles Clippers',rows,kickoff).length,1);
});
