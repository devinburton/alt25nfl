import{NextResponse}from"next/server";
import{fetchSportOdds,SPORT_CONFIG}from"../../../../lib/multiSportOdds";
import{getRecentResultsWindow,recentProfile}from"../../../../lib/espnSports";
import{getNbaResearch}from"../../../../lib/nbaResearch";
import{analyzeNbaSpread}from"../../../../lib/nbaSpreadsModel";
export const maxDuration=60;
export async function GET(){
  try{
    if(!process.env.ODDS_API_KEY)return NextResponse.json({message:"NBA odds connection is not configured."},{status:503});
    const odds=await fetchSportOdds("NBA");
    const upcoming=odds.games.filter(g=>Date.parse(g.kickoff)>Date.now()).sort((a,b)=>Date.parse(a.kickoff)-Date.parse(b.kickoff));
    const day=iso=>new Intl.DateTimeFormat("en-CA",{timeZone:"America/New_York"}).format(new Date(iso));
    const slate=upcoming.filter(g=>day(g.kickoff)===day(upcoming[0].kickoff));
    if(!slate.length)return NextResponse.json({status:"WAITING",message:"No upcoming NBA spreads are posted yet.",games:[],passes:[]});
    const[history,research]=await Promise.all([getRecentResultsWindow(SPORT_CONFIG.NBA.espnPath,slate[0].kickoff,35),getNbaResearch(slate)]);
    const regular=history.filter(g=>g.seasonType===2);
    const analyzed=slate.map(g=>analyzeNbaSpread({...g,awayProfile:recentProfile(g.away,regular,g.kickoff,10),homeProfile:recentProfile(g.home,regular,g.kickoff,10)},regular,research.get(g.id),{oddsFetchedAt:odds.fetchedAt}));
    const candidates=analyzed.filter(g=>g.status==="CANDIDATE").sort((a,b)=>b.expectedReturn-a.expectedReturn||b.score-a.score);
    return NextResponse.json({status:"ACTIVE",modelVersion:"nba-spreads-v1-beta",fetchedAt:odds.fetchedAt,researchAt:new Date().toISOString(),cacheHours:6,slateGames:slate.length,candidateCount:candidates.length,games:candidates.slice(0,5).map((g,i)=>({...g,rank:i+1})),passes:analyzed.filter(g=>g.status==="PASS")});
  }catch{return NextResponse.json({message:"NBA spread research could not load. Please try again shortly."},{status:502});}
}
