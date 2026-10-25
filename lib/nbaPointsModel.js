const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const round=n=>Math.round(n*10)/10;
export const playerKey=s=>String(s||"").normalize('NFD').replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"").replace(/(jr|sr|iii|ii)$/g,"");
export function parsePlayerLogs(data,season,before){
  const names=data?.names||[],pi=names.indexOf("points"),mi=names.indexOf("minutes");
  if(pi<0||mi<0)return[];
  const seen=new Set(),rows=[];
  for(const type of data.seasonTypes||[]){
    if(!/regular season/i.test(type.displayName||""))continue;
    for(const cat of type.categories||[])for(const row of cat.events||[]){
      const e=data.events?.[row.eventId],pts=row.stats?.[pi],mins=row.stats?.[mi];
      if(!e||seen.has(row.eventId)||!String(pts??"").trim()||!String(mins??"").trim())continue;
      const points=Number(pts),parts=String(mins).split(":"),minutes=Number(parts[0])+(parts.length===2?Number(parts[1])/60:0);
      if(!Number.isFinite(points)||!Number.isFinite(minutes)||minutes<=0||points<0||!Number.isFinite(Date.parse(e.gameDate))||Date.parse(e.gameDate)>=Date.parse(before))continue;
      seen.add(row.eventId);rows.push({id:row.eventId,date:e.gameDate,points,minutes:round(minutes),opponent:e.opponent?.displayName||"Unknown",opponentId:String(e.opponent?.id||""),teamId:String(e.team?.id||""),teamLabel:e.team?.abbreviation||e.team?.displayName||String(e.team?.id||"Unknown"),season,home:e.atVs==="vs"});
    }
  }
  return rows.sort((a,b)=>Date.parse(b.date)-Date.parse(a.date));
}
export function analyzePointsPlayer({player,team,opponent,opponentId,teamId,logs,season,quote,cushion=3,injuries=[],injuriesAvailable,matchup,now=Date.now(),kickoff}){
  const pass=reason=>({status:"PASS",player:player.name,team,reason});
  if(![2,3].includes(cushion))return pass("Unsupported alternate cushion.");
  if(Date.parse(kickoff)<=now)return pass("Game has started.");
  const qt=Date.parse(quote?.updatedAt);
  if(!Number.isFinite(quote?.line)||!Number.isFinite(qt)||now-qt>8*3600000)return pass("A fresh posted points line is unavailable.");
  if(!injuriesAvailable)return pass("Injury feed is unavailable or stale.");
  const injury=injuries.find(i=>playerKey(i.player)===playerKey(player.name));
  if(injury&&!/^(available|active|healthy)$/i.test(injury.status))return pass(`${player.name} has an injury designation (${injury.status}); no pick until cleared.`);
  const clean=[...new Map(logs.filter(r=>Date.parse(r.date)<Math.min(Date.parse(kickoff),now-6*3600000)).map(r=>[r.id,r])).values()].sort((a,b)=>Date.parse(b.date)-Date.parse(a.date));
  const current=clean.filter(r=>r.season===season&&r.teamId===String(teamId)).slice(0,10);
  const prior=clean.filter(r=>r.season===season-1).slice(0,20);
  if(current.length<2||current.length+prior.length<8)return pass(`Need two current-team games this season and eight combined current/prior-season games; available ${current.length}/${current.length+prior.length}.`);
  const recent=current.slice(0,5),minutes=mean(recent.map(r=>r.minutes));
  if(minutes<24)return pass("Recent minutes are below the 24-minute role threshold.");
  if(recent.length>=4&&mean(recent.slice(0,2).map(r=>r.minutes))<mean(recent.slice(2).map(r=>r.minutes))-5)return pass("Recent minutes have dropped materially; role needs confirmation.");
  const currentAvg=mean(current.map(r=>r.points)),priorAvg=mean(prior.map(r=>r.points));
  const priorWeight=prior.length?clamp((8-current.length)/12,0,.5):0;
  const baseline=currentAvg*(1-priorWeight)+(priorAvg??currentAvg)*priorWeight;
  const rate=mean(recent.map(r=>r.points/r.minutes));
  const form=.6*baseline+.4*rate*minutes;
  const h2h=clean.filter(r=>r.opponentId===String(opponentId)).slice(0,10);
  const sameTeamH2h=h2h.filter(r=>r.teamId===String(teamId));
  const h2hAvg=mean(sameTeamH2h.map(r=>r.points));
  const h2hAdjustment=sameTeamH2h.length>=3?clamp((h2hAvg-baseline)*Math.min(.15,sameTeamH2h.length/40),-1.5,1.5):0;
  const defenseAdjustment=Number.isFinite(matchup?.opponentAllowed)&&Number.isFinite(matchup?.leaguePoints)&&matchup.leaguePoints>0?clamp(form*(matchup.opponentAllowed/matchup.leaguePoints-1)*.3,-1.5,1.5):0;
  const restAdjustment=matchup?.restDays<1.5?-.5:0;
  // Keep the posted prop as the strongest prior; do not treat a tiny sample as certainty.
  const weight=Math.min(.6,.25+current.length*.035);
  const projection=quote.line+clamp(form+h2hAdjustment+defenseAdjustment+restAdjustment-quote.line,-8,8)*weight;
  const target=round(quote.line-cushion);
  if(target<=0)return pass("Alternate target must be positive.");
  const recentHits=recent.filter(r=>r.points>target).length;
  const edge=projection-target;
  if(projection<quote.line-.5||edge<2||recentHits/recent.length<.6)return pass("Recent scoring and projection do not support this Over target.");
  const score=round(clamp(edge*7+recentHits/recent.length*35+Math.min(current.length/10,1)*20+Math.min(minutes/36,1)*10,0,100));
  return{status:"CANDIDATE",player:player.name,athleteId:player.id,team,opponent,direction:"OVER",marketLine:quote.line,marketPrice:quote.price,book:quote.book,quotedAt:quote.updatedAt,target,cushion,projection:round(projection),edge:round(edge),score,currentAverage:round(currentAvg),priorAverage:priorAvg===null?null:round(priorAvg),currentGames:current.length,priorGames:prior.length,expectedMinutes:round(minutes),recentHits:{hits:recentHits,games:recent.length},h2hAverage:h2h.length?round(mean(h2h.map(r=>r.points))):null,h2hHits:{hits:h2h.filter(r=>r.points>target).length,games:h2h.length},recent,h2h,sourceUrl:`https://www.espn.com/nba/player/gamelog/_/id/${player.id}`,reasons:[`Projected ${round(projection)} points vs posted ${quote.line}; Over ${target} adds ${cushion} points of cushion.`,`Scored above this target in ${recentHits}/${recent.length} recent current-team games; averaging ${round(minutes)} minutes.`,`Current scoring ${round(currentAvg)} points over ${current.length} games${priorAvg===null?"":`; prior-season context ${round(priorAvg)} over ${prior.length} games`}.`,h2h.length?`Against ${opponent}: ${round(mean(h2h.map(r=>r.points)))} points across ${h2h.length} historical regular-season meetings; ${sameTeamH2h.length} with the current team.`:`No verified regular-season opponent history found in the three seasons checked.`,sameTeamH2h.length>=3?`Opponent-history adjustment ${round(h2hAdjustment)} points; capped and given limited weight.`:"Opponent history is too sparse for a projection adjustment.",`Opponent scoring-allowed context ${round(defenseAdjustment)} points; rest adjustment ${restAdjustment}.`],warnings:["Alternate target is a model suggestion; its availability and price are not verified. The displayed sportsbook price belongs to the main line only.","Recent hit rates and head-to-head results are descriptive, not a backtest or a calibrated chance of winning.","Minutes are estimated from game logs. Starting lineups and player-specific defensive assignments are not confirmed.",...(current.length<5?["Small current-season sample; prior-season context and a strong market anchor are used."]:[]),...(h2h.some(r=>r.teamId!==String(teamId))?["Some opponent meetings were played with a different team; those rows are labeled and excluded from the projection adjustment."]:[])]};
}
export function selectPointsPair(candidates,teams){return teams.map(team=>candidates.filter(p=>p.status==="CANDIDATE"&&p.team===team).sort((a,b)=>b.score-a.score||b.edge-a.edge)[0]).filter(Boolean);}
