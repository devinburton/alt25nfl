// Conservative default; no subscription change or additional paid markets.
export const ODDS_CACHE_HOURS = { NFL:12, NBA:6, NCAA:24, WNBA:24, MLB:24, NFL_SPREADS:24 };
export function budgetDecision(quota, kind='main') {
  if (!quota || !Number.isFinite(quota.remaining) || !Number.isFinite(quota.used) || quota.remaining<0 || quota.used<0) return {allowed:false,reason:'Odds credit balance could not be verified. New odds requests are paused.'};
  const total=quota.used+quota.remaining;
  if(total<=0)return {allowed:false,reason:'Odds credits are exhausted. New odds requests are paused.'};
  const reserve=kind==='props'?Math.max(100,total*.30):Math.max(1,total*.01);
  return quota.remaining>reserve?{allowed:true,reason:null}:{allowed:false,reason:kind==='props'?'Credit saver: new player-prop odds are paused to reserve credits for the main boards.':'Credit saver: new odds requests are paused at the final credit reserve. Cached research may remain available.'};
}
