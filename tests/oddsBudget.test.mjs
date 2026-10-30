import test from 'node:test';
import assert from 'node:assert/strict';
import { budgetDecision,ODDS_CACHE_HOURS } from '../lib/oddsBudgetPolicy.js';
test('80% used pauses props but allows main boards above reserve',()=>{
 assert.equal(budgetDecision({used:400,remaining:100},'props').allowed,false);
 assert.equal(budgetDecision({used:400,remaining:100}).allowed,true);
});
test('prop reserve scales with plan and core boards remain available until the final 1%',()=>{
 assert.equal(budgetDecision({used:7000,remaining:3000},'props').allowed,false);
 assert.equal(budgetDecision({used:9000,remaining:1000}).allowed,true);
 assert.equal(budgetDecision({used:9900,remaining:100}).allowed,false);
 assert.equal(budgetDecision({used:450,remaining:50}).allowed,true);
 assert.equal(budgetDecision({used:453,remaining:47}).allowed,true);
 assert.equal(budgetDecision({used:495,remaining:5}).allowed,false);
 assert.equal(budgetDecision({used:349,remaining:151},'props').allowed,true);
});
test('unknown, malformed and exhausted balances fail closed',()=>{
 for(const q of [null,{used:1},{remaining:10},{used:-1,remaining:40},{used:0,remaining:0},{used:500,remaining:0}])assert.equal(budgetDecision(q).allowed,false);
});
test('new allowance after reset resumes requests without a manual switch',()=>{
 assert.equal(budgetDecision({used:0,remaining:500},'props').allowed,true);
});
test('main snapshots have six-hour NBA, 12-hour NFL and daily other intervals',()=>{
 assert.equal(ODDS_CACHE_HOURS.NFL,12);assert.equal(ODDS_CACHE_HOURS.NBA,6);
 for(const id of ['NCAA','WNBA','MLB','NFL_SPREADS'])assert.equal(ODDS_CACHE_HOURS[id],24);
});
