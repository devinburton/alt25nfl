import { unstable_cache } from "next/cache";

export const SPORT_CONFIG = {
  NCAA: {
    id: "NCAA",
    title: "NCAA Football",
    shortTitle: "NCAA",
    key: "americanfootball_ncaaf",
    espnPath: "football/college-football",
    cacheHours: 6,
    recentGames: 4,
    edgeScale: 7,
    edgeCap: 10,
    slateMode: "week",
    modelType: "football"
  },
  NBA: {
    id: "NBA",
    title: "NBA",
    shortTitle: "NBA",
    key: "basketball_nba",
    espnPath: "basketball/nba",
    cacheHours: 6,
    recentGames: 5,
    edgeScale: 7,
    edgeCap: 12,
    slateMode: "day",
    modelType: "basketball"
  },
  WNBA: {
    id: "WNBA",
    title: "WNBA",
    shortTitle: "WNBA",
    key: "basketball_wnba",
    espnPath: "basketball/wnba",
    cacheHours: 6,
    recentGames: 5,
    edgeScale: 6.5,
    edgeCap: 10,
    slateMode: "day",
    modelType: "basketball"
  },
  MLB: {
    id: "MLB",
    title: "Baseball",
    shortTitle: "MLB",
    key: "baseball_mlb",
    espnPath: "baseball/mlb",
    cacheHours: 6,
    recentGames: 7,
    edgeScale: 1.8,
    edgeCap: 3.5,
    slateMode: "day",
    modelType: "baseball"
  }
};

function median(values){
  const nums=values.filter(Number.isFinite).sort((a,b)=>a-b);
  if(!nums.length)return null;
  const m=Math.floor(nums.length/2);
  return nums.length%2?nums[m]:(nums[m-1]+nums[m])/2;
}

async function fetchActiveSportsRaw(){
  const key=process.env.ODDS_API_KEY;
  if(!key)return [];
  const r=await fetch(`https://api.the-odds-api.com/v4/sports/?apiKey=${encodeURIComponent(key)}`,{cache:"no-store"});
  if(!r.ok)return [];
  return r.json();
}

const getActiveSportsCached=unstable_cache(
  fetchActiveSportsRaw,
  ["alt25-active-sports-v1"],
  {revalidate:21600}
);

export async function isSportActive(sportKey){
  const sports=await getActiveSportsCached();
  return sports.some(s=>s.key===sportKey&&s.active!==false);
}

async function fetchRawOdds(sportKey){
  const key=process.env.ODDS_API_KEY;
  if(!key)return{games:[],fetchedAt:null};

  const u=new URL(`https://api.the-odds-api.com/v4/sports/${sportKey}/odds`);
  u.searchParams.set("regions","us");
  u.searchParams.set("markets","totals");
  u.searchParams.set("oddsFormat","american");
  u.searchParams.set("apiKey",key);

  const r=await fetch(u,{cache:"no-store"});
  if(!r.ok){
    if(r.status===404)return{games:[],fetchedAt:new Date().toISOString()};
    throw new Error(`Odds API returned ${r.status}`);
  }

  const data=await r.json();
  const games=data.map(e=>{
    const totals=[];
    for(const b of e.bookmakers||[]){
      const m=(b.markets||[]).find(x=>x.key==="totals");
      const over=m?.outcomes?.find(x=>x.name==="Over");
      if(Number.isFinite(over?.point))totals.push(Number(over.point));
    }
    return{
      id:e.id,
      away:e.away_team,
      home:e.home_team,
      kickoff:e.commence_time,
      total:median(totals),
      booksCount:totals.length
    };
  }).filter(x=>Number.isFinite(x.total));

  return{games,fetchedAt:new Date().toISOString()};
}

const ncaafCached=unstable_cache(
  ()=>fetchRawOdds("americanfootball_ncaaf"),
  ["alt25-ncaaf-totals-v1"],
  {revalidate:21600}
);
const nbaCached=unstable_cache(
  ()=>fetchRawOdds("basketball_nba"),
  ["alt25-nba-totals-v1"],
  {revalidate:21600}
);
const wnbaCached=unstable_cache(
  ()=>fetchRawOdds("basketball_wnba"),
  ["alt25-wnba-totals-v1"],
  {revalidate:21600}
);
const mlbCached=unstable_cache(
  ()=>fetchRawOdds("baseball_mlb"),
  ["alt25-mlb-totals-v1"],
  {revalidate:21600}
);

export async function fetchSportOdds(id){
  if(id==="NCAA")return ncaafCached();
  if(id==="NBA")return nbaCached();
  if(id==="WNBA")return wnbaCached();
  if(id==="MLB")return mlbCached();
  return{games:[],fetchedAt:null};
}
