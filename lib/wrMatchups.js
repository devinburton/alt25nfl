import { unstable_cache } from "next/cache";
import { getCurrentWeekBundle, getScoreboardForDate, getTeamSummary } from "./espn";

const SITE="https://site.api.espn.com/apis/site/v2/sports/football/nfl";

const norm=(s="")=>String(s).toLowerCase().replace(/[^a-z0-9]/g,"");

function num(v){
  const m=String(v??"").replace(/,/g,"").match(/-?\d+(\.\d+)?/);
  return m?Number(m[0]):null;
}

function statText(s){
  return `${s?.name||""} ${s?.displayName||""} ${s?.label||""} ${s?.abbreviation||""}`.toLowerCase();
}

function findStat(stats,needles){
  return(stats||[]).find(s=>needles.some(n=>statText(s).includes(n)));
}

function completions(v){
  const s=String(v??"");
  const m=s.match(/(\d+)\s*[-/]\s*(\d+)/);
  return m?Number(m[1]):num(v);
}

function ymd(d){
  const y=d.getUTCFullYear();
  const m=String(d.getUTCMonth()+1).padStart(2,"0");
  const day=String(d.getUTCDate()).padStart(2,"0");
  return `${y}${m}${day}`;
}

// Fetch explicit recent dates instead of relying on ESPN's year-wide scoreboard behavior.
async function recentCompletedGames(days=24){
  const now=new Date();
  const dates=[];
  for(let i=1;i<=days;i++){
    dates.push(ymd(new Date(now.getTime()-i*86400000)));
  }

  const groups=await Promise.all(dates.map(getScoreboardForDate));
  const seen=new Set();
  return groups.flat()
    .filter(g=>g.completed)
    .filter(g=>{
      if(!g.id||seen.has(g.id))return false;
      seen.add(g.id);
      return true;
    });
}

function teamPassing(teamBox){
  const stats=teamBox?.statistics||[];
  const y=findStat(stats,[
    "net passing yards","netpassingyards",
    "passing yards","passingyards","pass yards"
  ]);
  const c=findStat(stats,[
    "completion attempts","completionattempts",
    "completions-attempts","completions"
  ]);

  return{
    yards:num(y?.displayValue??y?.value),
    comps:completions(c?.displayValue??c?.value)
  };
}

// Fallback if team-stat labels change: use individual passing boxscore.
function playerPassing(summary,teamName){
  const groups=summary?.boxscore?.players||[];
  const teamGroup=groups.find(g=>norm(g?.team?.displayName)===norm(teamName));
  if(!teamGroup)return null;

  const cat=(teamGroup.statistics||[]).find(s=>String(s?.name||"").toLowerCase().includes("pass"));
  if(!cat)return null;

  const labels=(cat.labels||[]).map(x=>String(x).toUpperCase());
  const cmpIdx=labels.findIndex(x=>x==="C/ATT"||x.includes("COMP"));
  const ydsIdx=labels.findIndex(x=>x==="YDS"||x.includes("YARDS"));

  let yards=0,comps=0,found=false;
  for(const row of cat.athletes||[]){
    const stats=row?.stats||[];
    const y=ydsIdx>=0?num(stats[ydsIdx]):null;
    const c=cmpIdx>=0?completions(stats[cmpIdx]):null;
    if(Number.isFinite(y)){yards+=y;found=true}
    if(Number.isFinite(c)){comps+=c;found=true}
  }

  return found?{yards,comps}:null;
}

function defenseRows(summary){
  const teams=summary?.boxscore?.teams||[];
  if(teams.length<2)return[];

  const a=teams[0],b=teams[1];
  const an=a?.team?.displayName,bn=b?.team?.displayName;
  if(!an||!bn)return[];

  let ap=teamPassing(a),bp=teamPassing(b);

  if(!Number.isFinite(ap.yards)||!Number.isFinite(ap.comps)){
    ap=playerPassing(summary,an)||ap;
  }
  if(!Number.isFinite(bp.yards)||!Number.isFinite(bp.comps)){
    bp=playerPassing(summary,bn)||bp;
  }

  return[
    {defense:bn,yards:ap?.yards,comps:ap?.comps},
    {defense:an,yards:bp?.yards,comps:bp?.comps}
  ];
}

// Pull current roster and recursively collect WRs.
// This is more reliable than depending on a depth-chart response shape.
async function rosterWrs(teamId){
  try{
    const r=await fetch(`${SITE}/teams/${teamId}/roster`,{next:{revalidate:21600}});
    if(!r.ok)return[];

    const d=await r.json();
    const found=[];

    function walk(x){
      if(!x)return;
      if(Array.isArray(x)){for(const v of x)walk(v);return}
      if(typeof x!=="object")return;

      const pos=String(x?.position?.abbreviation||x?.position?.name||"").toUpperCase();
      const id=x?.id||x?.athlete?.id;
      const name=x?.displayName||x?.fullName||x?.athlete?.displayName;

      if((pos==="WR"||pos.includes("WIDE RECEIVER"))&&id&&name){
        found.push({id:String(id),name});
      }

      for(const v of Object.values(x))walk(v);
    }

    walk(d);

    const seen=new Set();
    return found.filter(x=>{
      if(seen.has(x.id))return false;
      seen.add(x.id);
      return true;
    });
  }catch{return[]}
}

function receivingRows(summary,teamName){
  const groups=summary?.boxscore?.players||[];
  const teamGroup=groups.find(g=>norm(g?.team?.displayName)===norm(teamName));
  if(!teamGroup)return[];

  const cat=(teamGroup.statistics||[]).find(s=>String(s?.name||"").toLowerCase().includes("receiv"));
  if(!cat)return[];

  const labels=(cat.labels||[]).map(x=>String(x).toUpperCase());
  const recIdx=labels.findIndex(x=>x==="REC"||x.includes("RECEPT"));
  const ydsIdx=labels.findIndex(x=>x==="YDS"||x.includes("YARDS"));
  const avgIdx=labels.findIndex(x=>x==="AVG"||x.includes("AVERAGE"));

  return(cat.athletes||[]).map(row=>{
    const a=row?.athlete||{};
    const stats=row?.stats||[];
    return{
      id:a?.id?String(a.id):null,
      name:a?.displayName||a?.shortName||null,
      receptions:recIdx>=0?num(stats[recIdx]):null,
      yards:ydsIdx>=0?num(stats[ydsIdx]):null,
      avg:avgIdx>=0?num(stats[avgIdx]):null
    };
  }).filter(x=>x.id&&x.name);
}

function aggregateWrStats(teamName,wrIds,gameSummaries){
  const out=new Map();

  for(const summary of gameSummaries){
    for(const row of receivingRows(summary,teamName)){
      if(!wrIds.has(row.id))continue;
      const cur=out.get(row.id)||{
        id:row.id,name:row.name,games:0,yards:0,receptions:0
      };
      cur.games+=1;
      cur.yards+=Number(row.yards)||0;
      cur.receptions+=Number(row.receptions)||0;
      out.set(row.id,cur);
    }
  }

  return [...out.values()].map(x=>({
    ...x,
    yardsPerGame:x.games?x.yards/x.games:null,
    yardsPerReception:x.receptions?x.yards/x.receptions:null
  }));
}

async function build(){
  const current=await getCurrentWeekBundle();
  const now=Date.now();

  const slate=(current.events||[])
    .filter(g=>(g.week===current.week||!g.week))
    .filter(g=>new Date(g.kickoff).getTime()>now-2*3600000);

  const priorGames=await recentCompletedGames(24);
  const summaries=await Promise.all(priorGames.map(g=>getTeamSummary(g.id)));

  // 1) Rank defenses by opponent passing yards per completion allowed.
  const agg=new Map();
  for(const s of summaries){
    for(const r of defenseRows(s)){
      if(!Number.isFinite(r.yards)||!Number.isFinite(r.comps)||r.comps<=0)continue;
      const k=norm(r.defense);
      const cur=agg.get(k)||{team:r.defense,yards:0,comps:0,games:0};
      cur.yards+=r.yards;
      cur.comps+=r.comps;
      cur.games+=1;
      agg.set(k,cur);
    }
  }

  const defenses=[...agg.values()]
    .map(x=>({...x,ypc:x.yards/x.comps}))
    .filter(x=>Number.isFinite(x.ypc)&&x.games>=1)
    .sort((a,b)=>b.ypc-a.ypc);

  // Rank among defenses actually measured; worst defense gets #32-style label when 32 exist,
  // but early-season incomplete data will still work if fewer are present.
  const measured=defenses.length;
  defenses.forEach((x,i)=>x.defRank=Math.max(1,32-i));

  const bottom10=defenses.slice(0,Math.min(10,defenses.length));
  const bad=new Map(bottom10.map(x=>[norm(x.team),x]));

  // 2) Find this week's offenses facing those defenses.
  const opps=[];
  for(const g of slate){
    const homeDef=bad.get(norm(g.home));
    const awayDef=bad.get(norm(g.away));

    if(homeDef&&g.awayId){
      opps.push({team:g.away,teamId:g.awayId,opponent:g.home,defense:homeDef,kickoff:g.kickoff});
    }
    if(awayDef&&g.homeId){
      opps.push({team:g.home,teamId:g.homeId,opponent:g.away,defense:awayDef,kickoff:g.kickoff});
    }
  }

  // 3) Aggregate WR production from completed game boxscores.
  const candidates=[];
  for(const o of opps){
    const roster=await rosterWrs(o.teamId);
    const wrIds=new Set(roster.map(x=>x.id));
    const prod=aggregateWrStats(o.team,wrIds,summaries);
    const rosterName=new Map(roster.map(x=>[x.id,x.name]));

    // If a current WR has not recorded a catch yet, omit him from ranking rather than invent stats.
    for(const s of prod){
      candidates.push({
        player:rosterName.get(s.id)||s.name,
        athleteId:s.id,
        team:o.team,
        opponent:o.opponent,
        kickoff:o.kickoff,
        defenseRank:o.defense.defRank,
        oppYardsPerCompletion:+o.defense.ypc.toFixed(2),
        defenseGames:o.defense.games,
        yardsPerGame:Number.isFinite(s.yardsPerGame)?+s.yardsPerGame.toFixed(1):null,
        yardsPerReception:Number.isFinite(s.yardsPerReception)?+s.yardsPerReception.toFixed(1):null,
        receivingGames:s.games
      });
    }
  }

  const maxY=Math.max(1,...candidates.map(x=>x.yardsPerGame||0));
  const minD=bottom10.length?Math.min(...bottom10.map(x=>x.ypc)):0;
  const maxD=bottom10.length?Math.max(...bottom10.map(x=>x.ypc)):1;
  const range=Math.max(.01,maxD-minD);

  const players=candidates.map(x=>{
    const defenseScore=(x.oppYardsPerCompletion-minD)/range;
    const productionScore=Math.min(1,(x.yardsPerGame||0)/maxY);
    const yprScore=Math.min(1,(x.yardsPerReception||0)/20);
    const sampleScore=Math.min(1,(x.receivingGames||0)/2);

    const matchupScore=Math.round(
      defenseScore*.52*100+
      productionScore*.30*100+
      yprScore*.10*100+
      sampleScore*.08*100
    );

    return{...x,matchupScore};
  })
  .sort((a,b)=>b.matchupScore-a.matchupScore||(b.yardsPerGame||0)-(a.yardsPerGame||0))
  .slice(0,10)
  .map((x,i)=>({...x,rank:i+1}));

  return{
    year:current.year,
    week:current.week,
    updatedAt:new Date().toISOString(),
    metric:"Opponent passing yards per completion allowed",
    definition:"Bottom 10 means the defenses allowing the highest passing yards per completion among teams with available season-to-date data.",
    diagnostics:{
      upcomingGames:slate.length,
      completedGamesFound:priorGames.length,
      defensesMeasured:measured,
      qualifyingOffenses:opps.length,
      wrCandidates:candidates.length
    },
    players
  };
}

// New cache key so a previously cached empty result cannot survive this deployment.
const cached=unstable_cache(build,["alt25-nfl-wr-matchups-v2"],{revalidate:21600});

export async function getWrMatchups(){
  return cached();
}
