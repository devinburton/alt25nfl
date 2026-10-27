import{parseWinnerHistory}from'./nbaWinnerModel.js';
const BASE='https://site.api.espn.com/apis/site/v2/sports/basketball/nba';
const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'').replace(/^losangeles/,'la');
async function json(path,seconds){try{const r=await fetch(`${BASE}/${path}`,{next:{revalidate:seconds},signal:AbortSignal.timeout(8000)});return r.ok?await r.json():null;}catch{return null;}}
const eastern=x=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(x));
export async function winnerSlate(now=Date.now()){
  const days=[0,1,2].map(i=>eastern(now+i*86400000));
  const boards=await Promise.all([...new Set(days)].map(d=>json(`scoreboard?dates=${d.replaceAll('-','')}`,900)));
  const map=new Map();
  for(const board of boards)for(const e of board?.events||[]){
    const c=e.competitions?.[0],teams=c?.competitors||[],h=teams.find(x=>x.homeAway==='home'),a=teams.find(x=>x.homeAway==='away');
    if(!h?.team?.id||!a?.team?.id||Date.parse(e.date)<=now||c?.status?.type?.state!=='pre')continue;
    map.set(e.id,{id:e.id,season:Number(e.season?.year??board.season?.year),kickoff:e.date,away:a.team.displayName,home:h.team.displayName,awayId:String(a.team.id),homeId:String(h.team.id)});
  }
  const upcoming=[...map.values()].sort((a,b)=>Date.parse(a.kickoff)-Date.parse(b.kickoff));
  return upcoming.filter(g=>eastern(g.kickoff)===eastern(upcoming[0].kickoff));
}
export async function winnerHistory(teamId,season,kickoff){
  const results=await Promise.all([season,season-1,season-2].map(async y=>{
    const d=await json(`teams/${teamId}/schedule?season=${y}&seasontype=2`,y===season?1800:86400);
    return parseWinnerHistory(d,teamId,y,kickoff);
  }));return results.flat();
}
export function winnerMarket(game,markets){return markets.find(m=>norm(m.away)===norm(game.away)&&norm(m.home)===norm(game.home)&&Math.abs(Date.parse(m.kickoff)-Date.parse(game.kickoff))<3*3600000)||null;}
