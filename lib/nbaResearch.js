const BASE="https://site.api.espn.com/apis/site/v2/sports/basketball/nba";
const norm=s=>String(s||"").toLowerCase().replace(/[^a-z0-9]/g,"");
async function json(url){
  try{const r=await fetch(url,{next:{revalidate:900},signal:AbortSignal.timeout(10000)});return r.ok?await r.json():null;}catch{return null;}
}
const dateToken=iso=>new Intl.DateTimeFormat("en-CA",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(iso)).replaceAll("-","");
export async function getNbaResearch(games){
  const dates=[...new Set(games.map(g=>dateToken(g.kickoff)))];
  const [report,...boards]=await Promise.all([json(`${BASE}/injuries`),...dates.map(d=>json(`${BASE}/scoreboard?dates=${d}`))]);
  const events=boards.flatMap(b=>b?.events||[]);
  const feedTime=Date.parse(report?.timestamp);
  const available=Array.isArray(report?.injuries)&&Number.isFinite(feedTime)&&Date.now()-feedTime<24*3600000;
  return new Map(games.map(g=>{
    const event=events.find(e=>{const teams=e.competitions?.[0]?.competitors||[];return teams.some(t=>norm(t.team?.displayName)===norm(g.away))&&teams.some(t=>norm(t.team?.displayName)===norm(g.home));});
    const leaders=new Set((event?.competitions?.[0]?.competitors||[]).flatMap(t=>(t.leaders||[]).filter(l=>l.name==="pointsPerGame").flatMap(l=>(l.leaders||[]).map(x=>norm(x.athlete?.displayName)))));
    const injuries=(report?.injuries||[]).filter(t=>[norm(g.away),norm(g.home)].includes(norm(t.displayName))).flatMap(t=>(t.injuries||[]).map(i=>({team:t.displayName,player:i.athlete?.displayName||"Player",athleteId:String(i.athlete?.id||""),status:i.status||"Unknown",reportedAt:i.date||null,note:i.shortComment||""})));
    const unresolvedLeader=!event||leaders.size<2||injuries.some(i=>leaders.has(norm(i.player))&&/questionable|doubtful|day.to.day|game.time|unknown/i.test(i.status));
    return[g.id,{available,injuries,unresolvedLeader,sourceUrl:event?`https://www.espn.com/nba/game/_/gameId/${event.id}`:"https://www.espn.com/nba/injuries",reportAt:report?.timestamp||null}];
  }));
}
