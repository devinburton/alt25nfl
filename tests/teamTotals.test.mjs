import { test } from "node:test";
import assert from "node:assert/strict";
import { projectTeamTotals } from "../lib/teamTotalsModel.js";

const profile = (pointsFor, pointsAllowed, games = 5) => ({pointsFor, pointsAllowed, games});
const nflGame = {
  away:"Away", home:"Home", total:45.5, projected:47.5,
  awayProfile:profile(20,25), homeProfile:profile(27,21)
};

test("NFL splits total with the correct spread sign and gives a half-point Over target", ()=>{
  const [away,home] = projectTeamTotals(nflGame,"NFL",-3.5,5.5);
  assert.deepEqual(away,{name:"Away",implied:21,projected:21,gap:0,side:null,target:null});
  assert.deepEqual(home,{name:"Home",implied:24.5,projected:26.5,gap:2,side:"OVER",target:24.5});
});

test("NBA form can lower the away projection and raise the home projection", ()=>{
  const game = {
    away:"Away",home:"Home",total:225.5,projected:222.5,
    awayProfile:profile(104,120),homeProfile:profile(121,104)
  };
  const [away,home] = projectTeamTotals(game,"NBA",-2);
  assert.equal(away.side,"UNDER");
  assert.ok(away.target-away.projected>=2.5);
  assert.equal(away.target%1,0.5);
  assert.equal(home.side,null);
  assert.ok(Math.abs(away.projected+home.projected-game.projected)<0.101);
});

test("a positive home spread favors the away team, and missing data cannot produce a lean", ()=>{
  const game = {...nflGame,awayProfile:profile(20,25,1)};
  const [away,home] = projectTeamTotals(game,"NFL",3.5);
  assert.equal(away.implied,24.5);
  assert.equal(home.implied,21);
  assert.ok([away,home].every(team=>team.projected===null&&team.side===null&&team.target===null));
  assert.equal(projectTeamTotals(game,"NFL",null),null);
});
