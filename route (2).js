import{NextResponse}from"next/server";
import{SPORT_CONFIG,fetchSportOdds,isSportActive}from"../../../../lib/multiSportOdds";
import{getRecentResultsWindow,recentProfile}from"../../../../lib/espnSports";
import{getMlbGameContext}from"../../../../lib/mlbFreeData";
import{getLateSeasonContext,contextAdjustment}from"../../../../lib/seasonContext";
import{analyzeSportGame}from"../../../../lib/sportModel";

function easternDate(iso){
  const parts=new Intl.DateTimeFormat("en-CA",{year:"numeric",month:"2-digit",day:"2-digit",timeZone:"America/New_York"}).formatToParts(new Date(iso));
  const obj=Object.fromEntries(parts.map(x=>[x.type,x.value]));
  return`${obj.year}-${obj.month}-${obj.day}`;
}

function chooseSlate(games,mode){
  const upcoming=(games||[]).filter(g=>new Date(g.kickoff).getTime()>Date.now()-2*60*60*1000).sort((a,b)=>new Date(a.kickoff)-new Date(b.kickoff));
  if(!upcoming.length)return[];

  if(mode==="day"){
    const firstDate=easternDate(upcoming[0].kickoff);
    return upcoming.filter(g=>easternDate(g.kickoff)===firstDate);
  }

  // College football: nearest weekly slate, up to 6 days from first listed kickoff.
  const start=new Date(upcoming[0].kickoff).getTime();
  const end=start+6*86400000;
  return upcoming.filter(g=>{
    const t=new Date(g.kickoff).getTime();
    return t>=start&&t<=end;
  });
}

export async function GET(req,{params}){
  try{
    const resolvedParams=await params;
    const id=String(resolvedParams?.sport||"").toUpperCase();
    const config=SPORT_CONFIG[id];
    if(!config)return NextResponse.json({error:"Unknown sport"},{status:404});

    const active=await isSportActive(config.key);
    if(!active){
      return NextResponse.json({
        sport:id,
        title:config.title,
        status:"OFFSEASON",
        message:`${config.title} is not currently active in the odds feed.`,
        cacheHours:config.cacheHours,
        games:[]
      });
    }

    const oddsBundle=await fetchSportOdds(id);
    const slate=chooseSlate(oddsBundle.games,config.slateMode);

    if(!slate.length){
      return NextResponse.json({
        sport:id,
        title:config.title,
        status:"WAITING",
        message:"No totals are posted for the next slate yet.",
        fetchedAt:oddsBundle.fetchedAt,
        cacheHours:config.cacheHours,
        games:[]
      });
    }

    const historyDays=id==="MLB"?28:id==="NBA"||id==="WNBA"?35:70;
    const history=await getRecentResultsWindow(config.espnPath,slate[0].kickoff,historyDays);
    const mlbMap=id==="MLB"?await getMlbGameContext(slate):new Map();
    const norm=s=>String(s||"").toLowerCase().replace(/[^a-z0-9]/g,"");

    const analyzed=await Promise.all(slate.map(async g=>{
      const seasonContext=await getLateSeasonContext({
        sportId:id,
        espnPath:config.espnPath,
        game:g
      });

      return analyzeSportGame({
        ...g,
        awayProfile:recentProfile(g.away,history,g.kickoff,config.recentGames),
        homeProfile:recentProfile(g.home,history,g.kickoff,config.recentGames),
        mlbContext:id==="MLB"?mlbMap.get(`${norm(g.away)}-${norm(g.home)}`)||null:null,
        seasonContext,
        seasonContextEffect:contextAdjustment(seasonContext)
      },config);
    }));

    const top3=[...analyzed]
      .sort((a,b)=>(b.hotScore||0)-(a.hotScore||0)||Math.abs(b.edge||0)-Math.abs(a.edge||0))
      .slice(0,3)
      .map((g,i)=>({...g,rank:i+1}));

    return NextResponse.json({
      sport:id,
      title:config.title,
      status:"ACTIVE",
      fetchedAt:oddsBundle.fetchedAt,
      cacheHours:config.cacheHours,
      slateGames:slate.length,
      modelVersion:"smart-v2",
      games:top3
    });
  }catch(e){
    return NextResponse.json({error:e.message||"Unable to build sport board"},{status:500});
  }
}
