import { unstable_cache } from "next/cache";

function median(v){
  const n=v.filter(Number.isFinite).sort((a,b)=>a-b);
  if(!n.length)return null;
  const m=Math.floor(n.length/2);
  return n.length%2?n[m]:(n[m-1]+n[m])/2
}

async function fetchOddsRaw(){
  const key=process.env.ODDS_API_KEY;
  if(!key)return { games:[], fetchedAt:null };

  const u=new URL("https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds");
  u.searchParams.set("regions","us");
  u.searchParams.set("markets","totals");
  u.searchParams.set("oddsFormat","american");
  u.searchParams.set("apiKey",key);

  const r=await fetch(u,{cache:"no-store"});
  if(!r.ok)throw new Error(`Odds API returned ${r.status}`);

  const d=await r.json();
  const games=d.map(e=>{
    const totals=[];
    for(const b of e.bookmakers||[]){
      const m=(b.markets||[]).find(x=>x.key==="totals");
      const o=m?.outcomes?.find(x=>x.name==="Over");
      if(Number.isFinite(o?.point))totals.push(Number(o.point))
    }
    return{
      id:e.id,
      away:e.away_team,
      home:e.home_team,
      kickoff:e.commence_time,
      total:median(totals),
      booksCount:totals.length
    }
  }).filter(x=>Number.isFinite(x.total));

  return { games, fetchedAt:new Date().toISOString() };
}

const getCachedOdds = unstable_cache(
  fetchOddsRaw,
  ["alt25-nfl-live-totals-v1"],
  { revalidate: 7200 }
);

export async function fetchLiveNflTotals(){
  return getCachedOdds();
}
