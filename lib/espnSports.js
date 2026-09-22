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
    homeScore:Number.isFinite(hs)?hs:null,
    awayScore:Number.isFinite(as)?as:null,
    completed:Boolean(c?.status?.type?.completed)
  };
}

export async function getSeasonResults(espnPath,year){
  try{
    const url=`${ESPN_BASE}/${espnPath}/scoreboard?dates=${year}&limit=1000`;
    const r=await fetch(url,{next:{revalidate:3600}});
    if(!r.ok)return[];
    const d=await r.json();
    return(d.events||[]).map(parseEvent).filter(g=>g.home&&g.away);
  }catch{
    return[];
  }
}

function teamMatches(a,b){
  const x=normalize(a),y=normalize(b);
  return x===y||x.endsWith(y)||y.endsWith(x);
}

export function recentProfile(team,games,beforeISO,limit=5){
  const before=new Date(beforeISO).getTime();
  const recent=(games||[])
    .filter(g=>g.completed&&Number.isFinite(g.homeScore)&&Number.isFinite(g.awayScore)&&new Date(g.kickoff).getTime()<before&&(teamMatches(g.home,team)||teamMatches(g.away,team)))
    .sort((a,b)=>new Date(b.kickoff)-new Date(a.kickoff))
    .slice(0,limit);

  if(!recent.length)return null;

  let pf=0,pa=0,total=0,homePf=0,homeN=0,awayPf=0,awayN=0;
  for(const g of recent){
    const isHome=teamMatches(g.home,team);
    const f=isHome?g.homeScore:g.awayScore;
    const a=isHome?g.awayScore:g.homeScore;
    pf+=f;pa+=a;total+=f+a;
    if(isHome){homePf+=f;homeN++}else{awayPf+=f;awayN++}
  }

  return{
    games:recent.length,
    pointsFor:pf/recent.length,
    pointsAllowed:pa/recent.length,
    gameTotal:total/recent.length,
    homePoints:homeN?homePf/homeN:null,
    awayPoints:awayN?awayPf/awayN:null
  };
}
