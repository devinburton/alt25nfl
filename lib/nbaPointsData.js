import{unstable_cache}from"next/cache";
import{parsePlayerLogs,playerKey}from"./nbaPointsModel.js";
const BASE="https://site.api.espn.com/apis/site/v2/sports/basketball/nba";
const norm=s=>String(s||"").toLowerCase().replace(/[^a-z0-9]/g,"").replace(/^losangeles/,"la");
export async function espnJson(url,revalidate=900){try{const r=await fetch(url,{next:{revalidate},signal:AbortSignal.timeout(8000)});return r.ok?await r.json():null;}catch{return null;}}
export async function findPointsMatchup(game){
  const date=new Intl.DateTimeFormat("en-CA",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(game.kickoff)).replaceAll("-","");
  const board=await espnJson(`${BASE}/scoreboard?dates=${date}`);
  const e=board?.events?.find(e=>{const t=e.competitions?.[0]?.competitors||[];return t.some(x=>norm(x.team?.displayName)===norm(game.away))&&t.some(x=>norm(x.team?.displayName)===norm(game.home));});
  if(!e)return null;
  const teams=e.competitions[0].competitors;
  return{season:Number(e.season?.year),awayId:String(teams.find(t=>t.homeAway==="away")?.team?.id||""),homeId:String(teams.find(t=>t.homeAway==="home")?.team?.id||"")};
}
export async function roster(id){const d=await espnJson(`${BASE}/teams/${id}/roster`,3600);return(d?.athletes||[]).filter(a=>a.status?.type==="active").map(a=>({id:String(a.id),name:a.displayName||a.fullName}));}
export async function playerLogs(id,season,before){
  const data=await Promise.all([season,season-1,season-2].map(y=>espnJson(`https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/${id}/gamelog?season=${y}`,3600).then(d=>parsePlayerLogs(d,y,before))));
  return data.flat();
}
// Free sports endpoint reports remaining quota without spending odds credits.
const quota=unstable_cache(async()=>{
  try{const u=new URL("https://api.the-odds-api.com/v4/sports/");u.searchParams.set("apiKey",process.env.ODDS_API_KEY||"");const r=await fetch(u,{cache:"no-store",signal:AbortSignal.timeout(8000)});const remaining=r.headers.get("x-requests-remaining");return r.ok&&remaining!==null?Number(remaining):null;}catch{return null;}
},["nba-points-credit-check-v1"],{revalidate:900});
async function rawProps(eventId){
  const remaining=await quota();
  if(!Number.isFinite(remaining)||remaining<100)return{quotes:[],message:"Player-prop odds paused to preserve API credits for the main boards.",remaining};
  try{
    const u=new URL(`https://api.the-odds-api.com/v4/sports/basketball_nba/events/${eventId}/odds`);
    u.searchParams.set("apiKey",process.env.ODDS_API_KEY||"");u.searchParams.set("regions","us");u.searchParams.set("markets","player_points");u.searchParams.set("oddsFormat","american");
    const r=await fetch(u,{cache:"no-store",signal:AbortSignal.timeout(10000)});
    if(!r.ok)throw new Error(`Player-points odds are unavailable from the provider (status ${r.status}).`);
    const data=await r.json(),quotes=[];
    for(const b of data.bookmakers||[])for(const m of b.markets||[])if(m.key==="player_points")for(const o of m.outcomes||[])if(o.name==="Over"&&o.description&&Number.isFinite(o.point))quotes.push({player:o.description,line:o.point,price:o.price,book:b.title||b.key,updatedAt:m.last_update||b.last_update||null});
    if(!quotes.length)throw new Error("No posted player-points lines are available yet.");
    return{quotes,fetchedAt:new Date().toISOString(),remaining:Number(r.headers.get("x-requests-remaining"))};
  }catch(e){throw new Error(e.message?.startsWith("Player-points")||e.message?.startsWith("No posted")?e.message:"Player-points odds request timed out. Try again later.");}
}
// One event snapshot is shared across visitors and both cushion choices.
export async function pointsOdds(game){
  const hours=(Date.parse(game.kickoff)-Date.now())/3600000;
  if(hours<=0||hours>8)return{quotes:[],message:hours<=0?"Game has started.":"Prop research opens eight hours before tipoff to keep the snapshot useful and API usage low."};
  try{return await unstable_cache(()=>rawProps(game.id),["nba-player-points-v1",game.id],{revalidate:86400})();}catch(e){return{quotes:[],message:e.message};}
}
export function pointsCandidates(players,quotes){
  return players.map(player=>{
    // Only unambiguous, exact normalized roster matches are allowed.
    if(players.filter(p=>playerKey(p.name)===playerKey(player.name)).length!==1)return null;
    const q=quotes.filter(q=>playerKey(q.player)===playerKey(player.name)&&Number.isFinite(Date.parse(q.updatedAt))&&Date.now()-Date.parse(q.updatedAt)<8*3600000).sort((a,b)=>Date.parse(b.updatedAt)-Date.parse(a.updatedAt));
    return q.length?{player,quote:q[0]}:null;
  }).filter(Boolean).sort((a,b)=>b.quote.line-a.quote.line).slice(0,4);
}
