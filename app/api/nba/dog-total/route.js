import{NextResponse}from"next/server";
import{SPORT_CONFIG,fetchSportOdds}from"../../../../lib/multiSportOdds";
import{getRecentResultsWindow,recentProfile}from"../../../../lib/espnSports";
import{analyzeSportGame}from"../../../../lib/sportModel";
import{getNbaResearch}from"../../../../lib/nbaResearch";
import{analyzeDogTotal,MODEL_VERSION}from"../../../../lib/nbaDogTotalModel";
export const maxDuration=60;
export async function GET(){
  try{
    if(!process.env.ODDS_API_KEY)return NextResponse.json({status:"ERROR",message:"NBA odds connection is not configured.",games:[]},{status:503});
    const bundle=await fetchSportOdds("NBA");
    const upcoming=bundle.games.filter(g=>new Date(g.kickoff).getTime()>Date.now()).sort((a,b)=>new Date(a.kickoff)-new Date(b.kickoff));
    const day=iso=>new Intl.DateTimeFormat("en-CA",{timeZone:"America/New_York"}).format(new Date(iso));
    const slate=upcoming.filter(g=>day(g.kickoff)===day(upcoming[0].kickoff));
    if(!slate.length)return NextResponse.json({status:"WAITING",message:"No upcoming NBA market lines are available. The board updates automatically when the next slate posts.",games:[],fetchedAt:bundle.fetchedAt});
    const [allHistory,research]=await Promise.all([getRecentResultsWindow(SPORT_CONFIG.NBA.espnPath,slate[0].kickoff,35),getNbaResearch(slate)]);
    const history=allHistory.filter(g=>g.seasonType===2);
    const games=slate.map(g=>{
      const analyzed=analyzeSportGame({...g,awayProfile:recentProfile(g.away,history,g.kickoff,10),homeProfile:recentProfile(g.home,history,g.kickoff,10)}, {...SPORT_CONFIG.NBA,recentGames:10});
      return analyzeDogTotal(analyzed,history,research.get(g.id),{oddsFetchedAt:bundle.fetchedAt});
    }).sort((a,b)=>(b.researchScore||0)-(a.researchScore||0));
    return NextResponse.json({status:"ACTIVE",modelVersion:MODEL_VERSION,fetchedAt:bundle.fetchedAt,researchAt:new Date().toISOString(),cacheHours:12,games,candidates:games.filter(g=>g.status==="RESEARCH").length,methodology:"Market-anchored scoring and margin projections; correlated joint simulation with conservative variance floors. Minimum four regular-season games per team. Targets have no verified sportsbook quote. No value recommendation without a combined SGP price. No out-of-sample validation yet."});
  }catch{return NextResponse.json({status:"ERROR",message:"Unable to build NBA research right now. Try again shortly.",games:[]},{status:502});}
}
