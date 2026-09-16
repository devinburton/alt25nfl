const BASE="https://site.api.espn.com/apis/site/v2/sports/football/nfl";
export async function getScoreboard(){const r=await fetch(`${BASE}/scoreboard`,{next:{revalidate:900}});if(!r.ok)throw new Error("NFL schedule source unavailable");return r.json()}
export function parseScoreboardEvent(e){const c=e.competitions?.[0],cs=c?.competitors||[],h=cs.find(x=>x.homeAway==="home"),a=cs.find(x=>x.homeAway==="away");return{id:e.id,kickoff:e.date,week:e.week?.number,home:h?.team?.displayName,away:a?.team?.displayName,homeAbbr:h?.team?.abbreviation,awayAbbr:a?.team?.abbreviation,homeScore:Number(h?.score),awayScore:Number(a?.score),completed:Boolean(c?.status?.type?.completed),venue:c?.venue?.fullName||""}}
export async function getCurrentWeekBundle(){const d=await getScoreboard();return{year:d.season?.year||new Date().getFullYear(),week:d.week?.number||1,seasonType:d.season?.type||2,events:(d.events||[]).map(parseScoreboardEvent).filter(x=>x.home&&x.away)}}
export async function getSeasonScoreboard(year,seasonType=2){const r=await fetch(`${BASE}/scoreboard?dates=${year}&seasontype=${seasonType}&limit=1000`,{next:{revalidate:1800}});if(!r.ok)return[];const d=await r.json();return(d.events||[]).map(parseScoreboardEvent).filter(x=>x.home&&x.away)}
export async function getTeamSummary(eventId){try{const r=await fetch(`${BASE}/summary?event=${eventId}`,{next:{revalidate:1800}});if(!r.ok)return null;return r.json()}catch{return null}}

function num(v){if(v==null)return null;const n=Number(String(v).replace(/,/g,"").match(/-?\d+(\.\d+)?/)?.[0]);return Number.isFinite(n)?n:null}
function statText(s){return `${s?.name||""} ${s?.displayName||""} ${s?.label||""} ${s?.abbreviation||""}`.toLowerCase()}
function findStat(stats,needles){return(stats||[]).find(s=>needles.some(n=>statText(s).includes(n)))}
function ratio(v){const s=String(v||"");const m=s.match(/(\d+)\s*[-/]\s*(\d+)/);if(!m)return null;const a=Number(m[1]),b=Number(m[2]);return b>0?a/b:null}

export function parseBoxscoreMetrics(summary){
 const out={},teams=summary?.boxscore?.teams||[];
 for(const t of teams){
  const name=t?.team?.displayName;if(!name)continue;const s=t.statistics||[];
  const yards=num(findStat(s,["total yards","totalyards"])?.displayValue??findStat(s,["total yards","totalyards"])?.value);
  const plays=num(findStat(s,["total plays","offensive plays","totaloffensiveplays","plays"])?.displayValue??findStat(s,["total plays","offensive plays","totaloffensiveplays","plays"])?.value);
  const turnovers=num(findStat(s,["turnovers"])?.displayValue??findStat(s,["turnovers"])?.value);
  const thirdObj=findStat(s,["3rd down","third down","thirddowneff"]);
  const redObj=findStat(s,["red zone","redzone"]);
  const thirdPct=ratio(thirdObj?.displayValue);
  const redPct=ratio(redObj?.displayValue);
  out[name]={totalYards:yards,plays,ypp:Number.isFinite(yards)&&Number.isFinite(plays)&&plays>0?yards/plays:null,turnovers,thirdPct,redPct};
 }
 return out;
}

export function parseExplosivePlays(summary){
 const counts={};
 const drives=summary?.drives?.previous||summary?.drives?.current||[];
 for(const d of drives){for(const p of d?.plays||[]){const txt=String(p?.text||"").toLowerCase(),yds=num(p?.statYardage??p?.yards);if(!Number.isFinite(yds)||yds<20)continue;const team=p?.team?.displayName||p?.team?.name||null;if(team)counts[team]=(counts[team]||0)+1;else{
    for(const k of Object.keys(counts)) counts[k]=counts[k]||0;
  }}}
 return counts;
}

export function parseGameInjuries(summary){
 const result={};
 const groups=summary?.injuries||summary?.gameInfo?.injuries||[];
 if(Array.isArray(groups)){
  for(const g of groups){
   const team=g?.team?.displayName||g?.team?.name;
   const items=g?.injuries||g?.items||[];
   if(team) result[team]=items;
  }
 }
 return result;
}
