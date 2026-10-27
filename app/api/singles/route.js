import { NextResponse } from 'next/server';
import { SPORT_CONFIG, fetchSportOdds, isSportActive } from '../../../lib/multiSportOdds';
import { fetchLiveNflTotals } from '../../../lib/liveOdds';
import { getRecentResultsWindow } from '../../../lib/espnSports';
import { getNbaResearch } from '../../../lib/nbaResearch';
import { analyzeSingleTotal, selectTopSingles, SINGLES_RULES } from '../../../lib/topSinglesModel';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const configs = [{id:'NFL',key:'americanfootball_nfl',espnPath:'football/nfl',modelType:'football'}, ...Object.values(SPORT_CONFIG)];
const easternDay = iso => new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(iso));
async function scan(config) {
  try {
    if (!await isSportActive(config.key)) return {sport:config.id,status:'OFFSEASON',games:0,passes:[],candidates:[]};
    const bundle = await (config.id==='NFL'?fetchLiveNflTotals():fetchSportOdds(config.id));
    const upcoming = bundle.games.filter(g=>Date.parse(g.kickoff)>Date.now()).sort((a,b)=>Date.parse(a.kickoff)-Date.parse(b.kickoff));
    if (!upcoming.length) return {sport:config.id,status:'WAITING',games:0,passes:[],candidates:[]};
    const first = Date.parse(upcoming[0].kickoff);
    const slate = upcoming.filter(g=>config.modelType==='football'?Date.parse(g.kickoff)<=first+6*86400000:easternDay(g.kickoff)===easternDay(upcoming[0].kickoff));
    const days = config.modelType==='football'?70:config.modelType==='baseball'?45:45;
    const [history,research] = await Promise.all([getRecentResultsWindow(config.espnPath,slate[0].kickoff,days),config.id==='NBA'?getNbaResearch(slate):Promise.resolve(new Map())]);
    const results = slate.map(g=>analyzeSingleTotal(g,config,history,{fetchedAt:bundle.fetchedAt,research:research.get(g.id)}));
    return {sport:config.id,status:'SCANNED',games:slate.length,fetchedAt:bundle.fetchedAt,candidates:results.flatMap(r=>r.candidates),passes:results.filter(r=>!r.candidates.length).map(({candidates,...r})=>r)};
  } catch { return {sport:config.id,status:'ERROR',message:'This sport’s research feed is unavailable. No picks were inferred.',games:0,passes:[],candidates:[]}; }
}
export async function GET() {
  const scans = await Promise.all(configs.map(scan));
  return NextResponse.json({updatedAt:new Date().toISOString(),modelVersion:'singles-v1-beta',rules:SINGLES_RULES,games:selectTopSingles(scans.flatMap(s=>s.candidates)),coverage:scans.map(({candidates,...s})=>s)}, {headers:{'Cache-Control':'no-store'}});
}
