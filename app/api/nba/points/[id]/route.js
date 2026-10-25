import{NextResponse}from"next/server";
import{fetchSportOdds}from"../../../../../lib/multiSportOdds";
import{getRecentResultsWindow,recentProfile}from"../../../../../lib/espnSports";
import{getNbaResearch}from"../../../../../lib/nbaResearch";
import{findPointsMatchup,roster,playerLogs,pointsOdds,pointsCandidates}from"../../../../../lib/nbaPointsData";
import{analyzePointsPlayer,selectPointsPair}from"../../../../../lib/nbaPointsModel";
export const maxDuration=60;
export async function GET(req,{params}){try{
  const{id}=await params,cushion=Number(new URL(req.url).searchParams.get("cushion")||3);
  if(![2,3].includes(cushion))return NextResponse.json({message:"Choose a 2- or 3-point cushion."},{status:400});
  const odds=await fetchSportOdds("NBA"),g=odds.games.find(g=>g.id===id);
  if(!g)return NextResponse.json({message:"Matchup is not on the current odds board."},{status:404});
  const bundle=await pointsOdds(g);
  if(!bundle.quotes.length)return NextResponse.json({players:[],passes:[],message:bundle.message||"No posted player-points lines are available yet.",fetchedAt:bundle.fetchedAt});
  const[match,researchMap,history]=await Promise.all([findPointsMatchup(g),getNbaResearch([g]),getRecentResultsWindow("basketball/nba",g.kickoff,14)]);
  if(!match||!Number.isFinite(match.season))return NextResponse.json({players:[],passes:[],message:"Verified matchup and season information is unavailable."});
  const research=researchMap.get(g.id);
  const[awayRoster,homeRoster]=await Promise.all([roster(match.awayId),roster(match.homeId)]);
  const candidates=[...pointsCandidates(awayRoster,bundle.quotes).map(x=>({...x,team:g.away,teamId:match.awayId,opponent:g.home,opponentId:match.homeId})),...pointsCandidates(homeRoster,bundle.quotes).map(x=>({...x,team:g.home,teamId:match.homeId,opponent:g.away,opponentId:match.awayId}))];
  const regular=history.filter(x=>x.seasonType===2),league=regular.length?regular.reduce((s,x)=>s+x.homeScore+x.awayScore,0)/(regular.length*2):null;
  const profiles={away:recentProfile(g.away,regular,g.kickoff,10),home:recentProfile(g.home,regular,g.kickoff,10)};
  const results=[];
  // Four concurrent log lookups at a time; one lookup fetches three cached seasons.
  for(let i=0;i<candidates.length;i+=4){
    results.push(...await Promise.all(candidates.slice(i,i+4).map(async c=>{
      const logs=await playerLogs(c.player.id,match.season,g.kickoff);
      const own=c.team===g.away?profiles.away:profiles.home,opp=c.team===g.away?profiles.home:profiles.away;
      return analyzePointsPlayer({...c,logs,season:match.season,cushion,injuries:research?.injuries||[],injuriesAvailable:research?.available===true,matchup:{opponentAllowed:opp?.pointsAllowed,leaguePoints:league,restDays:own?.restDays},kickoff:g.kickoff});
    })));
  }
  const players=selectPointsPair(results,[g.away,g.home]);
  return NextResponse.json({players,passes:results.filter(r=>r.status==="PASS"),researched:candidates.length,fetchedAt:bundle.fetchedAt,researchAt:new Date().toISOString(),message:players.length===2?null:players.length?"Only one team has a qualifying player. The other side is a pass.":"No players meet the research requirements for this matchup.",modelVersion:"nba-points-v1-beta"});
}catch{return NextResponse.json({message:"Player research could not finish. Please try again shortly."},{status:502});}}
