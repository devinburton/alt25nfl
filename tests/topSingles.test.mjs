import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeSingleTotal,selectTopSingles,totalProbabilities} from '../lib/topSinglesModel.js';
const now=Date.parse('2026-10-27T16:00:00Z');
const kickoff=new Date(now+86400000).toISOString();
const config={id:'NFL',modelType:'football'};
const quotes=[{side:'OVER',line:30.5,price:-110,book:'Test',updatedAt:new Date(now-1000).toISOString()},{side:'UNDER',line:30.5,price:-110,book:'Test',updatedAt:new Date(now-1000).toISOString()}];
const game={id:'g',away:'A',home:'H',kickoff,total:45,booksCount:3,totalQuotes:quotes};
const history=Array.from({length:8},(_,i)=>({id:String(i),home:i<4?'A':'H',away:'Other',homeScore:28,awayScore:22,kickoff:new Date(now-(i+1)*86400000).toISOString(),completed:true,seasonType:2}));
const options={now,fetchedAt:new Date(now).toISOString()};
test('qualifies only an actual paired sportsbook line and computes return at that price',()=>{
  const result=analyzeSingleTotal(game,config,history,options);
  assert.equal(result.candidates.length,1);
  const p=result.candidates[0];assert.equal(p.line,30.5);assert.equal(p.side,'OVER');assert.ok(p.probability>=.65);assert.ok(p.edge>=.03);assert.ok(p.expectedReturn>=.02);
  assert.ok(Math.abs(p.expectedReturn-(p.probability*(100/110)-(1-p.probability-p.pushProbability)))<1e-10);
});
test('a high probability with a bad price is rejected',()=>{
  const bad={...game,totalQuotes:quotes.map(q=>({...q,price:q.side==='OVER'?-10000:2000}))};
  assert.equal(analyzeSingleTotal(bad,config,history,options).candidates.length,0);
});
test('missing opposite side, mismatched line or stale quotes cannot qualify',()=>{
  for(const qs of [quotes.slice(0,1),quotes.map((q,i)=>({...q,line:q.line+i})),quotes.map(q=>({...q,updatedAt:new Date(now-9*3600000).toISOString()}))])
    assert.equal(analyzeSingleTotal({...game,totalQuotes:qs},config,history,options).candidates.length,0);
});
test('thin, future, preseason and duplicate history cannot manufacture a sample',()=>{
  for(const rows of [history.slice(0,2),history.map(g=>({...g,seasonType:1})),history.map(g=>({...g,kickoff})),history.map(g=>({...g,id:'same'}))])
    assert.equal(analyzeSingleTotal(game,config,rows,options).candidates.length,0);
});
test('missing or stale odds and started games pass',()=>{
  for(const opt of [{now}, {...options,fetchedAt:new Date(now-9*3600000).toISOString()}])assert.equal(analyzeSingleTotal(game,config,history,opt).candidates.length,0);
  assert.equal(analyzeSingleTotal({...game,kickoff:new Date(now).toISOString()},config,history,options).candidates.length,0);
});
test('NBA unresolved injury screen causes a pass despite sufficient scoring history',()=>{
  const rows=Array.from({length:16},(_,i)=>({...history[i%8],id:String(i)}));
  assert.match(analyzeSingleTotal(game,{id:'NBA',modelType:'basketball'},rows,{...options,research:{available:true,unresolvedLeader:true}}).reason,/injury/);
});
test('integer total models push mass, fractional totals have none',()=>{
  const p=totalProbabilities(45,45,14,'OVER');assert.ok(p.push>0);assert.ok(Math.abs(p.win+p.loss+p.push-1)<1e-10);
  assert.equal(totalProbabilities(45,45.5,14,'OVER').push,0);
});
test('top ten sorts across sports by win chance, deduplicates games, rejects started and weak plays',()=>{
  const rows=Array.from({length:15},(_,i)=>({id:String(i),sport:i%2?'NFL':'NBA',kickoff,probability:.66+i/100,edge:.05,expectedReturn:.1}));
  const selected=selectTopSingles([...rows,{...rows[14],probability:.95},{...rows[0],id:'started',kickoff:new Date(now-1).toISOString()}, {...rows[0],id:'weak',edge:-.01}],now);
  assert.equal(selected.length,10);assert.equal(selected[0].probability,.95);assert.equal(new Set(selected.map(x=>x.sport+':'+x.id)).size,10);assert.equal(selected[0].rank,1);
  assert.equal(selectTopSingles([],now).length,0);
});

test('standard-total candidates between 55% and 65% can qualify without inflating the estimate',()=>{
 const standard={...game,totalQuotes:quotes.map(q=>({...q,line:44.5}))};
 const result=analyzeSingleTotal(standard,config,history,options);
 assert.equal(result.candidates.length,1);
 const p=result.candidates[0];assert.ok(p.probability>=.55&&p.probability<.65);assert.ok(p.edge>=.03&&p.expectedReturn>=.02);
 assert.equal(selectTopSingles([p],now).length,1);
 assert.equal(selectTopSingles([{...p,probability:.54}],now).length,0);
});
