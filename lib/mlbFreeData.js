function easternYmd(iso){
  const p=new Intl.DateTimeFormat("en-CA",{year:"numeric",month:"2-digit",day:"2-digit",timeZone:"America/New_York"}).formatToParts(new Date(iso));
  const o=Object.fromEntries(p.map(x=>[x.type,x.value]));
  return`${o.year}-${o.month}-${o.day}`;
}

function norm(s=""){return s.toLowerCase().replace(/[^a-z0-9]/g,"")}

async function pitcherEra(id,season){
  if(!id)return null;
  try{
    const r=await fetch(`https://statsapi.mlb.com/api/v1/people/${id}/stats?stats=season&group=pitching&season=${season}`,{next:{revalidate:21600}});
    if(!r.ok)return null;
    const d=await r.json();
    const era=Number(d?.stats?.[0]?.splits?.[0]?.stat?.era);
    return Number.isFinite(era)?era:null;
  }catch{return null}
}

export async function getMlbGameContext(games=[]){
  if(!games.length)return new Map();
  const date=easternYmd(games[0].kickoff);
  try{
    const r=await fetch(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${date}&hydrate=probablePitcher`,{next:{revalidate:10800}});
    if(!r.ok)return new Map();
    const d=await r.json();
    const items=d?.dates?.[0]?.games||[];
    const season=new Date(games[0].kickoff).getUTCFullYear();
    const out=new Map();

    for(const g of games){
      const m=items.find(x=>{
        const a=x?.teams?.away?.team?.name,h=x?.teams?.home?.team?.name;
        return norm(a)===norm(g.away)&&norm(h)===norm(g.home);
      });
      if(!m)continue;

      const awayP=m?.teams?.away?.probablePitcher;
      const homeP=m?.teams?.home?.probablePitcher;
      const [awayEra,homeEra]=await Promise.all([
        pitcherEra(awayP?.id,season),
        pitcherEra(homeP?.id,season)
      ]);

      out.set(`${norm(g.away)}-${norm(g.home)}`,{
        awayStarter:awayP?.fullName||null,
        homeStarter:homeP?.fullName||null,
        awayStarterEra:awayEra,
        homeStarterEra:homeEra
      });
    }
    return out;
  }catch{return new Map()}
}
