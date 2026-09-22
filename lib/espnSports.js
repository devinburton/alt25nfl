const ESPN_BASE="https://site.api.espn.com/apis/site/v2/sports";

function normalize(s=""){
  return s.toLowerCase().replace(/[^a-z0-9]/g,"");
}

function parseEvent(e){
  const c=e?.competitions?.[0];
  const teams=c?.competitors||[];
  const home=teams.find(x=>x.homeAway==="home");
  const away=teams.find(x=>x.homeAway==="away");

  const hs=Number(home?.score);
  const as=Number(away?.score);

  return{
    id:e?.id,
    kickoff:e?.date,
    home:home?.team?.displayName||home?.team?.shortDisplayName,
    away:away?.team?.displayName||away?.team?.shortDisplayName,
    homeId:home?.team?.id||null,
    awayId:away?.team?.id||null,
    homeScore:Number.isFinite(hs)?hs:null,
    awayScore:Number.isFinite(as)?as:null,
    completed:Boolean(c?.status?.type?.completed)
  };
}

async function fetchScoreboard(espnPath,dateToken){
  try{
    const url=`${ESPN_BASE}/${espnPath}/scoreboard?dates=${dateToken}&limit=1000`;
    const r=await fetch(url,{next:{revalidate:3600}});
    if(!r.ok)return[];
    const d=await r.json();
    return(d.events||[]).map(parseEvent).filter(g=>g.home&&g.away);
  }catch{return[]}
}

export async function getSeasonResults(espnPath,year){
  return fetchScoreboard(espnPath,year);
}

export async function getRecentResultsWindow(espnPath,beforeISO,days=45){
  const before=new Date(beforeISO);
  const dates=[];
  for(let i=1;i<=days;i++){
    const d=new Date(before.getTime()-i*86400000);
    const y=d.getUTCFullYear();
    const m=String(d.getUTCMonth()+1).padStart(2,"0");
    const day=String(d.getUTCDate()).padStart(2,"0");
    dates.push(`${y}${m}${day}`);
  }

  // Limit network fan-out by fetching in parallel; Next cache prevents repeated pulls.
  const chunks=[];
  for(let i=0;i<dates.length;i+=15){
    const batch=dates.slice(i,i+15);
    const res=await Promise.all(batch.map(x=>fetchScoreboard(espnPath,x)));
    chunks.push(...res.flat());
  }

  const seen=new Set();
  return chunks.filter(g=>{
    if(!g.id||seen.has(g.id))return false;
    seen.add(g.id);
    return g.completed;
  });
}

function teamMatches(a,b){
  const x=normalize(a),y=normalize(b);
  return x===y||x.endsWith(y)||y.endsWith(x);
}

function stddev(values){
  if(!values.length)return null;
  const avg=values.reduce((a,b)=>a+b,0)/values.length;
  const v=values.reduce((s,x)=>s+(x-avg)*(x-avg),0)/values.length;
  return Math.sqrt(v);
}

export function recentProfile(team,games,beforeISO,limit=5){
  const before=new Date(beforeISO).getTime();
  const recent=(games||[])
    .filter(g=>g.completed&&Number.isFinite(g.homeScore)&&Number.isFinite(g.awayScore)&&new Date(g.kickoff).getTime()<before&&(teamMatches(g.home,team)||teamMatches(g.away,team)))
    .sort((a,b)=>new Date(b.kickoff)-new Date(a.kickoff))
    .slice(0,limit);

  if(!recent.length)return null;

  let pf=0,pa=0,total=0,homePf=0,homePa=0,homeN=0,awayPf=0,awayPa=0,awayN=0;
  const scored=[],allowed=[],totals=[];
  for(const g of recent){
    const isHome=teamMatches(g.home,team);
    const f=isHome?g.homeScore:g.awayScore;
    const a=isHome?g.awayScore:g.homeScore;
    pf+=f;pa+=a;total+=f+a;
    scored.push(f);allowed.push(a);totals.push(f+a);
    if(isHome){homePf+=f;homePa+=a;homeN++}
    else{awayPf+=f;awayPa+=a;awayN++}
  }

  const last3=recent.slice(0,Math.min(3,recent.length));
  let l3pf=0,l3pa=0;
  for(const g of last3){
    const isHome=teamMatches(g.home,team);
    l3pf+=isHome?g.homeScore:g.awayScore;
    l3pa+=isHome?g.awayScore:g.homeScore;
  }

  const lastGameTime=new Date(recent[0].kickoff).getTime();
  const restDays=Math.max(0,(before-lastGameTime)/86400000);

  return{
    games:recent.length,
    pointsFor:pf/recent.length,
    pointsAllowed:pa/recent.length,
    gameTotal:total/recent.length,
    last3PointsFor:last3.length?l3pf/last3.length:null,
    last3PointsAllowed:last3.length?l3pa/last3.length:null,
    homePoints:homeN?homePf/homeN:null,
    homeAllowed:homeN?homePa/homeN:null,
    awayPoints:awayN?awayPf/awayN:null,
    awayAllowed:awayN?awayPa/awayN:null,
    scoringVolatility:stddev(scored),
    totalVolatility:stddev(totals),
    restDays:+restDays.toFixed(1)
  };
}
