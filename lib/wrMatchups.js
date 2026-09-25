import { unstable_cache } from "next/cache";
import { getCurrentWeekBundle, getSeasonScoreboard, getTeamSummary } from "./espn";

const SITE="https://site.api.espn.com/apis/site/v2/sports/football/nfl";
const CORE="https://sports.core.api.espn.com/v2/sports/football/leagues/nfl";

const norm=(s="")=>String(s).toLowerCase().replace(/[^a-z0-9]/g,"");
function num(v){const m=String(v??"").replace(/,/g,"").match(/-?\d+(\.\d+)?/);return m?Number(m[0]):null}
function text(s){return `${s?.name||""} ${s?.displayName||""} ${s?.label||""} ${s?.abbreviation||""}`.toLowerCase()}
function find(stats,needles){return(stats||[]).find(s=>needles.some(n=>text(s).includes(n)))}
function completions(v){const s=String(v??"");const m=s.match(/(\d+)\s*[-/]\s*(\d+)/);return m?Number(m[1]):num(v)}

function passing(teamBox){
  const stats=teamBox?.statistics||[];
  const y=find(stats,["net passing yards","netpassingyards","passing yards","passingyards","pass yards"]);
  const c=find(stats,["completion attempts","completionattempts","completions-attempts","completions"]);
  return{yards:num(y?.displayValue??y?.value),comps:completions(c?.displayValue??c?.value)};
}

function defenseRows(summary){
  const t=summary?.boxscore?.teams||[];
  if(t.length<2)return[];
  const a=t[0],b=t[1],an=a?.team?.displayName,bn=b?.team?.displayName;
  if(!an||!bn)return[];
  const ap=passing(a),bp=passing(b);
  return[
    {defense:bn,yards:ap.yards,comps:ap.comps},
    {defense:an,yards:bp.yards,comps:bp.comps}
  ];
}

async function depthWrs(teamId){
  try{
    const r=await fetch(`${SITE}/teams/${teamId}/depthcharts`,{next:{revalidate:21600}});
    if(!r.ok)return[];
    const d=await r.json(),out=[];
    for(const chart of d?.depthCharts||[]){
      if(String(chart?.name||"").toLowerCase()!=="offense")continue;
      for(const p of Object.values(chart?.positions||{})){
        const ab=String(p?.position?.abbreviation||"").toUpperCase();
        const name=String(p?.position?.name||"").toLowerCase();
        if(!(ab.includes("WR")||name.includes("wide receiver")))continue;
        for(const row of p?.athletes||[]){
          const a=row?.athlete;
          if(a?.id&&a?.displayName)out.push({id:String(a.id),name:a.displayName,rank:Number(row?.rank)||99});
        }
      }
    }
    const seen=new Set();
    return out.sort((a,b)=>a.rank-b.rank).filter(x=>{if(seen.has(x.id))return false;seen.add(x.id);return true}).slice(0,4);
  }catch{return[]}
}

async function wrStats(id,year){
  try{
    const r=await fetch(`${CORE}/seasons/${year}/athletes/${id}/statistics`,{next:{revalidate:21600}});
    if(!r.ok)return null;
    const d=await r.json(),cats=d?.splits?.categories||[];
    const rec=cats.find(c=>String(c?.name||"").toLowerCase().includes("receiv"));
    const general=cats.find(c=>String(c?.name||"").toLowerCase().includes("general"));
    const stats=rec?.stats||[];
    const stat=(names)=>{
      for(const n of names){
        const s=stats.find(x=>String(x?.name||"").toLowerCase()===n||String(x?.abbreviation||"").toLowerCase()===n);
        if(s)return num(s.value??s.displayValue);
      }
      return null;
    };
    const receptions=stat(["receptions","rec"]);
    const receivingYards=stat(["receivingyards","yards","yds"]);
    const ypr=stat(["yardsperreception","receivingyardsperreception","avg"]);
    const ypg=stat(["receivingyardspergame","yardspergame","yds/g"]);
    const gs=(general?.stats||[]).find(x=>["gamesplayed","games"].includes(String(x?.name||"").toLowerCase()));
    const games=num(gs?.value??gs?.displayValue);
    return{
      receivingYards,receptions,yardsPerReception:ypr,games,
      yardsPerGame:Number.isFinite(ypg)?ypg:(Number.isFinite(receivingYards)&&games>0?receivingYards/games:null)
    };
  }catch{return null}
}

async function build(){
  const current=await getCurrentWeekBundle(),now=Date.now();
  const slate=(current.events||[]).filter(g=>(g.week===current.week||!g.week)&&new Date(g.kickoff).getTime()>now-2*3600000);
  const season=(await getSeasonScoreboard(current.year,current.seasonType)).filter(g=>g.completed&&new Date(g.kickoff).getTime()<now);
  const sums=await Promise.all(season.map(g=>getTeamSummary(g.id)));
  const agg=new Map();

  for(const s of sums){
    for(const r of defenseRows(s)){
      if(!Number.isFinite(r.yards)||!Number.isFinite(r.comps)||r.comps<=0)continue;
      const k=norm(r.defense),x=agg.get(k)||{team:r.defense,yards:0,comps:0,games:0};
      x.yards+=r.yards;x.comps+=r.comps;x.games++;agg.set(k,x);
    }
  }

  const defenses=[...agg.values()].map(x=>({...x,ypc:x.yards/x.comps}))
    .filter(x=>Number.isFinite(x.ypc)).sort((a,b)=>b.ypc-a.ypc)
    .map((x,i)=>({...x,defRank:32-i}));
  const bottom10=defenses.slice(0,10),bad=new Map(bottom10.map(x=>[norm(x.team),x]));

  const opps=[];
  for(const g of slate){
    const hd=bad.get(norm(g.home)),ad=bad.get(norm(g.away));
    if(hd&&g.awayId)opps.push({team:g.away,teamId:g.awayId,opp:g.home,d:hd,kickoff:g.kickoff});
    if(ad&&g.homeId)opps.push({team:g.home,teamId:g.homeId,opp:g.away,d:ad,kickoff:g.kickoff});
  }

  const cand=[];
  for(const o of opps){
    const wrs=await depthWrs(o.teamId);
    const stats=await Promise.all(wrs.map(w=>wrStats(w.id,current.year)));
    wrs.forEach((w,i)=>{
      const s=stats[i]; if(!s)return;
      cand.push({
        player:w.name,athleteId:w.id,team:o.team,opponent:o.opp,kickoff:o.kickoff,
        defenseRank:o.d.defRank,oppYardsPerCompletion:+o.d.ypc.toFixed(2),
        yardsPerGame:Number.isFinite(s.yardsPerGame)?+s.yardsPerGame.toFixed(1):null,
        yardsPerReception:Number.isFinite(s.yardsPerReception)?+s.yardsPerReception.toFixed(1):null
      });
    });
  }

  const maxY=Math.max(1,...cand.map(x=>x.yardsPerGame||0));
  const minD=Math.min(...bottom10.map(x=>x.ypc)),maxD=Math.max(...bottom10.map(x=>x.ypc)),range=Math.max(.01,maxD-minD);
  const players=cand.map(x=>{
    const ds=(x.oppYardsPerCompletion-minD)/range,ps=Math.min(1,(x.yardsPerGame||0)/maxY),ys=Math.min(1,(x.yardsPerReception||0)/20);
    return{...x,matchupScore:Math.round((ds*.58+ps*.30+ys*.12)*100)};
  }).sort((a,b)=>b.matchupScore-a.matchupScore||(b.yardsPerGame||0)-(a.yardsPerGame||0))
    .slice(0,10).map((x,i)=>({...x,rank:i+1}));

  return{
    year:current.year,week:current.week,updatedAt:new Date().toISOString(),
    metric:"Opponent passing yards per completion allowed",
    definition:"Bottom 10 means the 10 defenses allowing the highest passing yards per completion.",
    players
  };
}

const cached=unstable_cache(build,["alt25-nfl-wr-matchups-v1"],{revalidate:21600});
export async function getWrMatchups(){return cached()}
