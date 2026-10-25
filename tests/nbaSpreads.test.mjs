import test from 'node:test';
import assert from 'node:assert/strict';
import{analyzeNbaSpread,spreadProbabilities,decimalOdds}from'../lib/nbaSpreadsModel.js';
const now=Date.parse('2026-11-20T15:00:00Z'),fresh=new Date(now-3600000).toISOString();
const kickoff='2026-11-20T23:00:00Z';
const profile={pointsFor:110,pointsAllowed:110,restDays:2};
const history=Array.from({length:10},(_,i)=>[
{id:`a${i}`,home:'Away',away:'Other',homeScore:110+i%3,awayScore:115-i%3},
{id:`h${i}`,home:'Home',away:'Other',homeScore:120+i%3,awayScore:105-i%3}
].map(g=>({...g,completed:true,seasonType:2,kickoff:`2026-11-${19-i}T00:00:00Z`}))).flat();
const game={id:'g',away:'Away',home:'Home',kickoff,awaySpread:3,spreadBooksCount:9,marketUpdatedAt:fresh,awayProfile:{...profile,pointsFor:100,pointsAllowed:120},homeProfile:{...profile,pointsFor:125,pointsAllowed:100},spreadQuotes:[{team:'Home',line:-3,price:-110,book:'Book A',updatedAt:fresh},{team:'Home',line:-3,price:-105,book:'Book B',updatedAt:fresh}]};
const research={available:true,injuries:[],unresolvedLeader:false};
const analyze=(g=game,h=history,r=research)=>analyzeNbaSpread(g,h,r,{now,oddsFetchedAt:fresh});
test('selects favorite with strongest exact-line price and accounts for pushes',()=>{const g=analyze();assert.equal(g.status,'CANDIDATE');assert.equal(g.team,'Home');assert.equal(g.line,-3);assert.equal(g.book,'Book B');assert.equal(g.price,-105);assert.ok(g.pushProbability>0);assert.ok(g.expectedReturn>=2);});
test('can select away underdog instead of automatically choosing favorites',()=>{const g=analyze({...game,awayProfile:game.homeProfile,homeProfile:game.awayProfile,spreadQuotes:[{team:'Away',line:3,price:-110,book:'Book A',updatedAt:fresh}]});assert.equal(g.status,'CANDIDATE');assert.equal(g.team,'Away');assert.equal(g.line,3);});
test('passes weak edges and insufficient regular-season samples',()=>{assert.equal(analyze({...game,awayProfile:profile,homeProfile:profile}).status,'PASS');assert.equal(analyze(game,history.slice(0,4)).status,'PASS');assert.equal(analyze(game,history.map(x=>({...x,seasonType:1}))).status,'PASS');});
test('never pairs a modeled line with a stale or different-line quote',()=>{assert.equal(analyze({...game,spreadQuotes:game.spreadQuotes.map(q=>({...q,line:-4}))}).status,'PASS');assert.equal(analyze({...game,spreadQuotes:game.spreadQuotes.map(q=>({...q,updatedAt:'2026-11-19T00:00:00Z'}))}).status,'PASS');});
test('screens unresolved injuries, stale markets and started games',()=>{assert.equal(analyze(game,history,{...research,unresolvedLeader:true}).status,'PASS');assert.equal(analyze({...game,marketUpdatedAt:null}).status,'PASS');assert.equal(analyze({...game,kickoff:'2026-11-20T14:00:00Z'}).status,'PASS');});
test('integer and half-point probability mass and EV price sensitivity',()=>{const p=spreadProbabilities(3,-3,14);assert.ok(Math.abs(p.win+p.loss+p.push-1)<1e-9);assert.ok(p.push>0);const h=spreadProbabilities(3,-3.5,14);assert.equal(h.push,0);assert.ok(h.win<p.win+.001);assert.equal(decimalOdds(0),null);assert.equal(analyze({...game,spreadQuotes:[{team:'Home',line:-3,price:-300,book:'Costly',updatedAt:fresh}]}).status,'PASS');});
