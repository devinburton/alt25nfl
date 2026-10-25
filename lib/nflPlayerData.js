import{extractNflTeam}from'./nflPlayerModel.js';
const BASE='https://site.api.espn.com/apis/site/v2/sports/football/nfl';
export async function nflJson(path,revalidate=900){try{const r=await fetch(`${BASE}/${path}`,{next:{revalidate},signal:AbortSignal.timeout(8000)});return r.ok?await r.json():null;}catch{return null;}}
export function parseNflRoster(data){
  const out=[];
  function walk(x){if(!x||typeof x!=='object')return;if(Array.isArray(x)){x.forEach(walk);return;}
    if(x.id&&x.displayName&&x.position?.abbreviation&&x.status?.type==='active')out.push({id:String(x.id),name:x.displayName,position:x.position.abbreviation});
    if(x.athletes)walk(x.athletes);
    if(x.items)walk(x.items);
  }
  walk(data?.athletes);return[...new Map(out.map(x=>[x.id,x])).values()];
}
export function depthStarter(data){for(const d of data?.depthchart||[]){const qb=Object.entries(d.positions||{}).find(([name])=>name.toLowerCase()==='qb')?.[1];if(qb?.athletes?.[0]?.id)return String(qb.athletes[0].id);}return null;}
export async function nflTeamResearch(teamId,year,before){
  const[schedule,roster,depth]=await Promise.all([nflJson(`teams/${teamId}/schedule?season=${year}&seasontype=2`,3600),nflJson(`teams/${teamId}/roster`,3600),nflJson(`teams/${teamId}/depthcharts`)]);
  const completed=(schedule?.events||[]).filter(e=>e.competitions?.[0]?.status?.type?.completed&&Number(e.seasonType?.type??e.seasonType?.id)===2&&Date.parse(e.date)<Math.min(Date.parse(before),Date.now())).sort((a,b)=>Date.parse(b.date)-Date.parse(a.date)).slice(0,4);
  const games=await Promise.all(completed.map(async e=>{const s=await nflJson(`summary?event=${e.id}`,1800),opponent=e.competitions[0].competitors.find(t=>String(t.team?.id)!==String(teamId));return{id:e.id,date:e.date,opponentName:opponent?.team?.displayName||'Opponent',own:extractNflTeam(s,teamId),opponent:extractNflTeam(s,opponent?.team?.id)};}));
  const dt=Date.parse(depth?.timestamp);
  return{roster:parseNflRoster(roster),starter:Number.isFinite(dt)&&Date.now()-dt<24*3600000?depthStarter(depth):null,games};
}
export function nflInjuries(report,teamId){const time=Date.parse(report?.timestamp);return{available:Array.isArray(report?.injuries)&&Number.isFinite(time)&&Date.now()-time<24*3600000,items:(report?.injuries||[]).filter(t=>String(t.id)===String(teamId)).flatMap(t=>(t.injuries||[]).map(i=>({player:i.athlete?.displayName||'Player',id:String(i.athlete?.id||''),status:i.status||'Unknown'})))};}
