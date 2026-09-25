import{NextResponse}from"next/server";
import{getCurrentWeekBundle,getSeasonScoreboard,getTeamSummary,parseGameInjuries,getScheduleForDates,getUpcomingSchedule}from"../../../lib/espn";
import{fetchLiveNflTotals}from"../../../lib/liveOdds";
import{getGameWeather}from"../../../lib/weather";
import{buildTeamProfile,injuryAdjustment}from"../../../lib/analytics";
import{analyzeGame}from"../../../lib/model";
import{getLateSeasonContext,contextAdjustment}from"../../../lib/seasonContext";

export const dynamic="force-dynamic";
const norm=(s="")=>s.toLowerCase().replace(/[^a-z0-9]/g,"");
const keyOf=g=>`${norm(g.away)}-${norm(g.home)}`;

function ymd(iso){
  const d=new Date(iso);
  const y=d.getUTCFullYear(),m=String(d.getUTCMonth()+1).padStart(2,"0"),day=String(d.getUTCDate()).padStart(2,"0");
  return `${y}${m}${day}`;
}

function easternWeekday(iso){
  return new Intl.DateTimeFormat("en-US",{weekday:"short",timeZone:"America/New_York"}).format(new Date(iso))
}

export async function GET(){
 try{
  const [current,oddsBundle]=await Promise.all([getCurrentWeekBundle(),fetchLiveNflTotals()]);
  const allOdds=(oddsBundle.games||[]).filter(o=>new Date(o.kickoff).getTime()>Date.now()-3*60*60*1000);

  // If books have not posted the next slate yet, keep the site alive with upcoming schedule cards.
  if(!allOdds.length){
    const upcoming=await getUpcomingSchedule(9);
    const firstWeek=upcoming.find(g=>g.week)?.week??current.week;
    const slate=upcoming.filter(g=>!g.week||g.week===firstWeek);
    return NextResponse.json({
      updatedAt:new Date().toISOString(),
      oddsFetchedAt:oddsBundle.fetchedAt,
      oddsCacheHours:2,
      year:current.year,
      week:firstWeek,
      oddsMode:"WAITING FOR LINES",
      boardMode:"WAITING",
      modelVersion:"always-on-v1",
      altRule:2.5,
      games:[],
      upcomingSchedule:slate,
      parlay:[],
      sundayLottery:[]
    })
  }

  // Use the dates already present in the cached Odds API response to resolve ESPN week/event IDs.
  const schedule=await getScheduleForDates(allOdds.map(o=>ymd(o.kickoff)));
  const scheduleMap=new Map(schedule.map(s=>[keyOf(s),s]));

  // Attach ESPN metadata to each odds event.
  const merged=allOdds.map(o=>{
    const s=scheduleMap.get(keyOf(o));
    return{
      ...o,
      espnId:s?.id||null,
      week:s?.week||null,
      homeAbbr:s?.homeAbbr||null,
      awayAbbr:s?.awayAbbr||null,
      venue:s?.venue||""
    }
  }).sort((a,b)=>new Date(a.kickoff)-new Date(b.kickoff));

  // Pick the nearest NFL week represented by the upcoming odds board.
  const firstWithWeek=merged.find(g=>Number.isFinite(g.week));
  const targetWeek=firstWithWeek?.week??current.week;
  const firstKickoff=new Date(merged[0].kickoff).getTime();
  const fallbackEnd=firstKickoff+5*86400000;

  const slateOdds=merged.filter(g=>{
    if(Number.isFinite(g.week))return g.week===targetWeek;
    const t=new Date(g.kickoff).getTime();
    return t>=firstKickoff&&t<=fallbackEnd;
  });

  const seasonGames=await getSeasonScoreboard(current.year,current.seasonType);

  const rows=await Promise.all(slateOdds.map(async o=>{
    const s={
      id:o.espnId,
      kickoff:o.kickoff,
      week:o.week||targetWeek,
      home:o.home,
      away:o.away,
      homeAbbr:o.homeAbbr,
      awayAbbr:o.awayAbbr,
      venue:o.venue
    };

    const[weather,awayProfile,homeProfile,gameSummary]=await Promise.all([
      getGameWeather(s.home,s.kickoff),
      buildTeamProfile(s.away,seasonGames,s.kickoff),
      buildTeamProfile(s.home,seasonGames,s.kickoff),
      getTeamSummary(s.id)
    ]);

    const inj=parseGameInjuries(gameSummary),
          awayItems=inj[s.away]||[],
          homeItems=inj[s.home]||[];

    const seasonContext=await getLateSeasonContext({
      sportId:"NFL",
      espnPath:"football/nfl",
      game:s
    });
    return analyzeGame({
      ...s,
      total:o.total,
      booksCount:o.booksCount,
      weather,
      awayProfile,
      homeProfile,
      awayInjury:injuryAdjustment(awayItems),
      homeInjury:injuryAdjustment(homeItems),
      seasonContext,
      seasonContextEffect:contextAdjustment(seasonContext)
    })
  }));

  const games=rows.filter(Boolean).sort((a,b)=>new Date(a.kickoff)-new Date(b.kickoff));
  const ranked=[...games].sort((a,b)=>(b.hotScore||0)-(a.hotScore||0)||Math.abs(b.edge||0)-Math.abs(a.edge||0));
  const hotIds=new Map(ranked.slice(0,5).map((g,i)=>[`${g.away}-${g.home}-${g.kickoff}`,i+1]));
  const decorated=games.map(g=>{
    const k=`${g.away}-${g.home}-${g.kickoff}`;
    return{...g,hotRank:hotIds.get(k)||null,isHot:hotIds.has(k)}
  });

  const nextKickoff=Math.min(...games.map(g=>new Date(g.kickoff).getTime()));
  const hoursToKickoff=(nextKickoff-Date.now())/3600000;
  const boardMode=hoursToKickoff>48?"EARLY":"ACTIVE";

  return NextResponse.json({
    updatedAt:new Date().toISOString(),
    oddsFetchedAt:oddsBundle.fetchedAt,
    oddsCacheHours:2,
    year:current.year,
    week:targetWeek,
    oddsMode:boardMode==="EARLY"?"EARLY CONSENSUS":"LIVE CONSENSUS",
    boardMode,
    modelVersion:"always-on-v1",
    altRule:2.5,
    games:decorated,
    upcomingSchedule:[],
  })
 }catch(e){
  return NextResponse.json({error:e.message||"Unable to build board"},{status:500})
 }
}
