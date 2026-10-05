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
  u.searchParams.set("markets","spreads,h2h");
  u.searchParams.set("oddsFormat","american");
  u.searchParams.set("apiKey",key);

  const r=await fetch(u,{cache:"no-store"});
  if(!r.ok)throw new Error(`Odds API spreads returned ${r.status}`);

  const d=await r.json();
  const games=d.map(e=>{
    const homePoints=[],awayPoints=[],homeMl=[],awayMl=[];
    for(const b of e.bookmakers||[]){
      const spreadMarket=(b.markets||[]).find(x=>x.key==="spreads");
      if(spreadMarket){
        const home=spreadMarket.outcomes?.find(x=>x.name===e.home_team);
        const away=spreadMarket.outcomes?.find(x=>x.name===e.away_team);
        if(Number.isFinite(home?.point))homePoints.push(Number(home.point));
        if(Number.isFinite(away?.point))awayPoints.push(Number(away.point));
      }
      const mlMarket=(b.markets||[]).find(x=>x.key==="h2h");
      if(mlMarket){
        const home=mlMarket.outcomes?.find(x=>x.name===e.home_team);
        const away=mlMarket.outcomes?.find(x=>x.name===e.away_team);
        if(Number.isFinite(home?.price))homeMl.push(Number(home.price));
        if(Number.isFinite(away?.price))awayMl.push(Number(away.price));
      }
    }

    return{
      id:e.id,
      away:e.away_team,
      home:e.home_team,
      kickoff:e.commence_time,
      homeSpread:median(homePoints),
      awaySpread:median(awayPoints),
      homeMl:median(homeMl),
      awayMl:median(awayMl),
      booksCount:Math.max(homePoints.length,awayPoints.length,homeMl.length,awayMl.length)
    };
  }).filter(x=>(Number.isFinite(x.homeSpread)&&Number.isFinite(x.awaySpread))||(Number.isFinite(x.homeMl)&&Number.isFinite(x.awayMl)));

  return{games,fetchedAt:new Date().toISOString()};
}

// Spread prices do not need the same 2-hour refresh as totals.
// Twelve hours keeps spreads + moneylines very light on API credits.
const getCachedSpreads=unstable_cache(
  fetchSpreadsRaw,
  ["alt25-nfl-live-spreads-v1"],
  {revalidate:43200}
);

export async function fetchLiveNflSpreads(){
  return getCachedSpreads();
}
