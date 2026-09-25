const ESPN_BASE="https://site.api.espn.com/apis/site/v2/sports";

function norm(s=""){return String(s||"").toLowerCase().replace(/[^a-z0-9]/g,"")}

async function fetchJson(url,revalidate=3600){
  try{
    const r=await fetch(url,{next:{revalidate}});
    if(!r.ok)return null;
    return r.json();
  }catch{return null}
}

function teamMatches(a,b){
  const x=norm(a),y=norm(b);
  return x===y||x.endsWith(y)||y.endsWith(x);
}

async function getStandings(espnPath){
  return fetchJson(`${ESPN_BASE}/${espnPath}/standings`,3600);
}

function parseStandings(data){
  const rows=[];
  for(const group of data?.children||[]){
    for(const e of group?.standings?.entries||[]){
      const team=e?.team;
      if(!team?.displayName)continue;
      const stats=e?.stats||[];
      const find=(names)=>{
        for(const name of names){
          const s=stats.find(x=>{
            const n=String(x?.name||"").toLowerCase();
            const a=String(x?.abbreviation||"").toLowerCase();
            return n===name||a===name;
          });
          if(s)return s.value ?? s.displayValue ?? null;
        }
        return null;
      };
      const seed=Number(find(["playoffseed","seed","rank"]));
      const wins=Number(find(["wins","w"]));
      const losses=Number(find(["losses","l"]));
      const gamesBehind=Number(find(["gamesbehind","gb"]));
      rows.push({
        team:team.displayName,
        playoffSeed:Number.isFinite(seed)?seed:null,
        wins:Number.isFinite(wins)?wins:null,
        losses:Number.isFinite(losses)?losses:null,
        gamesBehind:Number.isFinite(gamesBehind)?gamesBehind:null
      });
    }
  }
  return rows;
}

function isLateSeason(sportId,kickoff){
  const d=new Date(kickoff);
  const month=d.getUTCMonth()+1;
  if(sportId==="WNBA")return month>=8;
  if(sportId==="NBA")return month>=3;
  if(sportId==="MLB")return month>=9;
  if(sportId==="NFL")return month>=11 || month===1;
  if(sportId==="NCAA")return month>=11 || month===1;
  return false;
}

function cutoffFor(sportId){
  if(sportId==="WNBA")return 8;
  if(sportId==="NBA")return 10;
  if(sportId==="NFL")return 7;
  if(sportId==="MLB")return 6; // 3 division winners + 3 wild cards per league
  return null;
}

export async function getLateSeasonContext({sportId,espnPath,game}){
  if(!isLateSeason(sportId,game.kickoff))return null;

  // NCAA does not map cleanly to one league-wide playoff seed table.
  // Keep the context conservative and record-based rather than inventing playoff status.
  if(sportId==="NCAA"){
    const raw=await getStandings(espnPath);
    const table=parseStandings(raw);
    const away=table.find(x=>teamMatches(x.team,game.away))||null;
    const home=table.find(x=>teamMatches(x.team,game.home))||null;
    return{
      sportId,
      mode:"record_only",
      away,
      home
    };
  }

  const raw=await getStandings(espnPath);
  const table=parseStandings(raw);
  if(!table.length)return null;

  const away=table.find(x=>teamMatches(x.team,game.away));
  const home=table.find(x=>teamMatches(x.team,game.home));
  if(!away||!home)return null;

  const cutoff=cutoffFor(sportId);
  const classify=(row)=>{
    if(!Number.isFinite(row.playoffSeed)||!cutoff)return "unknown";
    if(row.playoffSeed<=Math.max(1,cutoff-2))return "likely_clinched";
    if(row.playoffSeed<=cutoff+2)return "bubble_or_seeding";
    return "likely_eliminated";
  };

  return{
    sportId,
    mode:"standings",
    away:{...away,status:classify(away)},
    home:{...home,status:classify(home)}
  };
}

export function contextAdjustment(context){
  if(!context)return{adjustment:0,confidencePenalty:0,label:null};

  if(context.mode==="record_only"){
    const flags=[];
    let confidencePenalty=0;

    const describe=(row,label)=>{
      if(!row||!Number.isFinite(row.wins)||!Number.isFinite(row.losses))return;
      const games=row.wins+row.losses;
      if(games<8)return;
      if(row.wins>=8)flags.push(`${label} strong late-season record`);
      else if(row.wins<=4){
        flags.push(`${label} possible late-season rotation/motivation volatility`);
        confidencePenalty+=3;
      }else{
        flags.push(`${label} late-season stakes uncertain`);
        confidencePenalty+=1;
      }
    };

    describe(context.away,"Away");
    describe(context.home,"Home");

    return{
      adjustment:0,
      confidencePenalty,
      label:flags.length?flags.join(" • "):"Late-season college context active"
    };
  }

  const statuses=[context.away?.status,context.home?.status];
  const clinched=statuses.filter(x=>x==="likely_clinched").length;
  const bubble=statuses.filter(x=>x==="bubble_or_seeding").length;
  const eliminated=statuses.filter(x=>x==="likely_eliminated").length;

  let adjustment=0;
  let confidencePenalty=0;
  const flags=[];

  if(clinched){
    // Sport-specific direction: rest/rotation generally suppresses expected scoring
    // in basketball/football; in baseball use smaller directional effect.
    const per=context.sportId==="MLB" ? 0.20 : 1.25;
    adjustment-=per*clinched;
    flags.push(`${clinched} team${clinched>1?"s":""} with possible rest/rotation risk`);
  }

  if(bubble){
    const per=context.sportId==="MLB" ? 0.10 : 0.75;
    adjustment+=per*bubble;
    flags.push(`${bubble} team${bubble>1?"s":""} with seeding/playoff incentive`);
  }

  if(eliminated){
    confidencePenalty += context.sportId==="MLB" ? 3 : 6;
    flags.push(`${eliminated} team${eliminated>1?"s":""} likely out of contention`);
  }

  return{
    adjustment,
    confidencePenalty,
    label:flags.length?flags.join(" • "):null
  };
}
