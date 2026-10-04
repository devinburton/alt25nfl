import { unstable_cache } from "next/cache";

function median(v){
  const n=v.filter(Number.isFinite).sort((a,b)=>a-b);
  if(!n.length)return null;
  const m=Math.floor(n.length/2);
  return n.length%2?n[m]:(n[m-1]+n[m])/2;
}

async function fetchSpreadsRaw(){
  const key=process.env.ODDS_API_KEY;
  if(!key)return {games:[],fetchedAt:null};

  const u=new URL("https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds");
  u.searchParams.set("regions","us");
  u.searchParams.set("markets","spreads");
  u.searchParams.set("oddsFormat","american");
  u.searchParams.set("apiKey",key);

  const r=await fetch(u,{cache:"no-store"});
  if(!r.ok)throw new Error(`Odds API spreads returned ${r.status}`);

  const d=await r.json();
  const games=d.map(e=>{
    const homePoints=[],awayPoints=[];
    for(const b of e.bookmakers||[]){
      const market=(b.markets||[]).find(x=>x.key==="spreads");
      if(!market)continue;
      const home=market.outcomes?.find(x=>x.name===e.home_team);
      const away=market.outcomes?.find(x=>x.name===e.away_team);
      if(Number.isFinite(home?.point))homePoints.push(Number(home.point));
      if(Number.isFinite(away?.point))awayPoints.push(Number(away.point));
    }

    return{
      id:e.id,
      away:e.away_team,
      home:e.home_team,
      kickoff:e.commence_time,
      homeSpread:median(homePoints),
      awaySpread:median(awayPoints),
      booksCount:Math.max(homePoints.length,awayPoints.length)
    };
  }).filter(x=>Number.isFinite(x.homeSpread)&&Number.isFinite(x.awaySpread));

  return{games,fetchedAt:new Date().toISOString()};
}

// Spread prices do not need the same 2-hour refresh as totals.
// Twelve hours keeps this feature very light on API credits.
const getCachedSpreads=unstable_cache(
  fetchSpreadsRaw,
  ["alt25-nfl-live-spreads-v1"],
  {revalidate:43200}
);

export async function fetchLiveNflSpreads(){
  return getCachedSpreads();
}
