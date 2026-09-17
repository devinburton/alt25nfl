import{NextResponse}from"next/server";import{getCurrentWeekBundle,getSeasonScoreboard,getTeamSummary,parseGameInjuries}from"../../../lib/espn";import{fetchLiveNflTotals}from"../../../lib/liveOdds";import{getGameWeather}from"../../../lib/weather";import{buildTeamProfile,injuryAdjustment}from"../../../lib/analytics";import{analyzeGame}from"../../../lib/model";
export const dynamic="force-dynamic";const norm=(s="")=>s.toLowerCase().replace(/[^a-z0-9]/g,"");
export async function GET(){try{
 const current=await getCurrentWeekBundle(),[seasonGames,oddsBundle]=await Promise.all([getSeasonScoreboard(current.year,current.seasonType),fetchLiveNflTotals()]),odds=oddsBundle.games||[],om=new Map(odds.map(o=>[`${norm(o.away)}-${norm(o.home)}`,o]));
 const rows=await Promise.all(current.events.filter(g=>g.week===current.week||!g.week).map(async s=>{
  const o=om.get(`${norm(s.away)}-${norm(s.home)}`);if(!o)return null;
  const[weather,awayProfile,homeProfile,gameSummary]=await Promise.all([getGameWeather(s.home,s.kickoff),buildTeamProfile(s.away,seasonGames,s.kickoff),buildTeamProfile(s.home,seasonGames,s.kickoff),getTeamSummary(s.id)]);
  const inj=parseGameInjuries(gameSummary),awayItems=inj[s.away]||[],homeItems=inj[s.home]||[];
  return analyzeGame({...s,total:o.total,booksCount:o.booksCount,weather,awayProfile,homeProfile,awayInjury:injuryAdjustment(awayItems),homeInjury:injuryAdjustment(homeItems)})
 }));
 const games=rows.filter(Boolean).sort((a,b)=>new Date(a.kickoff)-new Date(b.kickoff));
 const ranked=[...games].sort((a,b)=>(b.hotScore||0)-(a.hotScore||0)||Math.abs(b.edge||0)-Math.abs(a.edge||0));
 const keyOf=g=>`${g.away}-${g.home}-${g.kickoff}`;
 const hotIds=new Map(ranked.slice(0,5).map((g,i)=>[keyOf(g),i+1]));

 // 3-leg parlay: top three model-rated games from the full weekly slate.
 const parlayKeys=new Set(ranked.slice(0,3).map(keyOf));

 // Sunday lottery: every Sunday game on the slate, intentionally built as a mega-longshot ticket.
 const sundayGames=ranked.filter(g=>{
   const d=new Date(g.kickoff);
   const eastern=new Intl.DateTimeFormat("en-US",{weekday:"short",timeZone:"America/New_York"}).format(d);
   return eastern==="Sun";
 });
 const lotteryKeys=new Set(sundayGames.map(keyOf));

 const decorated=games.map(g=>({
   ...g,
   hotRank:hotIds.get(keyOf(g))||null,
   isHot:hotIds.has(keyOf(g)),
   isParlay:parlayKeys.has(keyOf(g)),
   isLottery:lotteryKeys.has(keyOf(g))
 }));

 const parlay=ranked.slice(0,3).map((g,i)=>({...g,parlayRank:i+1}));
 const sundayLottery=sundayGames.map((g,i)=>({...g,lotteryRank:i+1}));

 return NextResponse.json({
   updatedAt:new Date().toISOString(),
   oddsFetchedAt:oddsBundle.fetchedAt,
   oddsCacheHours:2,
   year:current.year,
   week:current.week,
   oddsMode:"LIVE CONSENSUS",
   modelVersion:"hot-v2-credit-saver",
   altRule:2.5,
   games:decorated,
   parlay,
   sundayLottery
 })
}catch(e){return NextResponse.json({error:e.message||"Unable to build board"},{status:500})}}
