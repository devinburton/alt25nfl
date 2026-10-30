import { NextResponse } from 'next/server';
import { getOddsBudget, ODDS_CACHE_HOURS } from '../../../lib/oddsBudget';
import { budgetDecision } from '../../../lib/oddsBudgetPolicy';
export async function GET(){
  const quota=await getOddsBudget();
  return NextResponse.json({mode:'CREDIT_SAVER',...quota,usagePercent:quota&&quota.used+quota.remaining>0?Math.round(quota.used/(quota.used+quota.remaining)*100):null,propsPaused:!budgetDecision(quota,'props').allowed,mainPaused:!budgetDecision(quota).allowed,cacheHours:ODDS_CACHE_HOURS},{headers:{'Cache-Control':'no-store'}});
}
