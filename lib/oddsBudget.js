import { unstable_cache } from 'next/cache';
import { budgetDecision, ODDS_CACHE_HOURS } from './oddsBudgetPolicy';
export { ODDS_CACHE_HOURS };
// Balance lookup is shared across routes; credentials remain server-only.
export const getOddsBudget=unstable_cache(async()=>{
  if(!process.env.ODDS_API_KEY)return null;
  try{
    const u=new URL('https://api.the-odds-api.com/v4/sports/');u.searchParams.set('apiKey',process.env.ODDS_API_KEY);
    const r=await fetch(u,{cache:'no-store',signal:AbortSignal.timeout(8000)});
    const remaining=r.headers.get('x-requests-remaining'),used=r.headers.get('x-requests-used');
    if(!r.ok||remaining===null||used===null)return null;
    const quota={remaining:Number(remaining),used:Number(used),checkedAt:new Date().toISOString()};
    return Number.isFinite(quota.remaining)&&Number.isFinite(quota.used)?quota:null;
  }catch{return null;}
},['alt25-shared-credit-balance-v1'],{revalidate:60});
export async function requireOddsBudget(kind='main'){
  const quota=await getOddsBudget(),decision=budgetDecision(quota,kind);
  if(!decision.allowed)throw new Error(decision.reason);
  return quota;
}
