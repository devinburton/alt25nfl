import{NextResponse}from'next/server';
import{getCurrentWeekBundle,getUpcomingSchedule}from'../../../../../lib/espn';
import{getGameWeather}from'../../../../../lib/weather';
import{nflJson,nflTeamResearch,nflInjuries}from'../../../../../lib/nflPlayerData';
import{touchdownCandidates,projectQuarterback,compareQuarterbacks}from'../../../../../lib/nflPlayerModel';
export const maxDuration=60;
export async function GET(req,{params}){try{
  const{id}=await params,current=await getCurrentWeekBundle();let game=current.events.find(g=>g.id===id);
  if(!game)game=(await getUpcomingSchedule(9)).find(g=>g.id===id);
  if(!game)return NextResponse.json({message:'Matchup is not on the upcoming NFL schedule.'},{status:404});
  if(Date.parse(game.kickoff)<=Date.now()||game.completed)return NextResponse.json({message:'Game has started; pregame research is closed.',touchdowns:[],quarterbacks:[],passes:[]});
  const[away,home,report,weather]=await Promise.all([nflTeamResearch(game.awayId,current.year,game.kickoff),nflTeamResearch(game.homeId,current.year,game.kickoff),nflJson('injuries'),getGameWeather(game.home,game.kickoff)]);
  const ai=nflInjuries(report,game.awayId),hi=nflInjuries(report,game.homeId);
  const input=(own,opp,team,inj)=>({team,roster:own.roster,starter:own.starter,games:own.games,opponentGames:opp.games,injuries:inj.items,injuriesAvailable:inj.available,weather});
  const a=input(away,home,game.away,ai),h=input(home,away,game.home,hi);
  const tdA=touchdownCandidates(a),tdH=touchdownCandidates(h),comparison=compareQuarterbacks([projectQuarterback(a),projectQuarterback(h)]);
  return NextResponse.json({modelVersion:'nfl-player-research-v1-beta',updatedAt:new Date().toISOString(),weather:weather.label,touchdowns:[...tdA.players,...tdH.players].sort((a,b)=>b.score-a.score).slice(0,2).map((p,i)=>({...p,rank:i+1})),touchdownPasses:[...(tdA.reason?[{team:game.away,reason:tdA.reason}]:[]),...(tdH.reason?[{team:game.home,reason:tdH.reason}]:[])],quarterbacks:comparison.qbs,highestProjected:comparison.winner,closeComparison:comparison.close,passes:comparison.passes,warnings:['Research beta: ranking scores are not calibrated scoring probabilities and yardage projections are not guarantees.','Touchdown ranking counts rushing and receiving TDs only. Passing TDs, return TDs and defensive TDs are excluded.','No live touchdown or passing-yards prop odds are used. These rankings do not establish betting value.','Injury statuses and depth charts can change before kickoff; red-zone touches, snap counts, and confirmed game-day lineups are not modeled.']});
}catch{return NextResponse.json({message:'NFL player research could not finish. Please try again shortly.'},{status:502});}}
