const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
const round=n=>Math.round(n*10)/10;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function score(v){if(v===null||v===undefined||v==='')return null;const n=Number(typeof v==='object'?v.value??v.displayValue:v);return Number.isFinite(n)?n:null;}
export function parseWinnerHistory(data,teamId,season,before,now=Date.now()){
  const seen=new Set(),rows=[];
  for(const e of data?.events||[]){
    const c=e.competitions?.[0],teams=c?.competitors||[],own=teams.find(t=>String(t.team?.id)===String(teamId)),opp=teams.find(t=>String(t.team?.id)!==String(teamId));
    const f=score(own?.score),a=score(opp?.score),date=Date.parse(e.date);
    if((e.season?.year!=null&&Number(e.season.year)!==season)||seen.has(e.id)||!c?.status?.type?.completed||Number(e.seasonType?.type??e.seasonType?.id)!==2||!own||!opp||f===null||a===null||!Number.isFinite(date)||date>=Math.min(Date.parse(before),now))continue;
    seen.add(e.id);rows.push({id:e.id,date:e.date,season,home:own.homeAway==='home',opponent:opp.team.displayName,opponentId:String(opp.team.id),pointsFor:f,pointsAgainst:a,margin:f-a,win:f>a});
  }
  return rows.sort((a,b)=>Date.parse(b.date)-Date.parse(a.date));
}
export function winnerTeamProfile(history,season,kickoff,home){
  const rows=[...new Map(history.filter(r=>Date.parse(r.date)<Date.parse(kickoff)&&r.season>=season-2&&r.season<=season).map(r=>[r.id,r])).values()].sort((a,b)=>Date.parse(b.date)-Date.parse(a.date));
  const seasons=[season,season-1,season-2].map(year=>{
    const list=rows.filter(r=>r.season===year),wins=list.filter(r=>r.win).length;
    return{season:year,label:`${year-1}–${String(year).slice(-2)}`,games:list.length,wins,losses:list.length-wins,margin:list.length?round(mean(list.map(r=>r.margin))):null,weight:year===season?Math.min(.6,list.length/20*.6):year===season-1?.3:.1};
  });
  const usable=seasons.filter(s=>s.games),weight=usable.reduce((s,r)=>s+r.weight,0);
  const historicalMargin=weight?usable.reduce((s,r)=>s+r.margin*r.weight,0)/weight:null;
  const current=rows.filter(r=>r.season===season),recent=current.slice(0,10),venue=current.filter(r=>r.home===home);
  return{seasons,totalGames:rows.length,historicalMargin:historicalMargin===null?null:round(historicalMargin),recentAverage:recent.length?round(mean(recent.map(r=>r.margin))):null,recentWins:recent.filter(r=>r.win).length,recentGames:recent.length,venueMargin:venue.length>=3?round(mean(venue.map(r=>r.margin))):null,venueGames:venue.length,restDays:current.length?round((Date.parse(kickoff)-Date.parse(current[0].date))/86400000):null,recent:recent.slice(0,5),rows};
}
function cdf(x){const t=1/(1+.2316419*Math.abs(x)),d=.3989422804*Math.exp(-x*x/2);const p=1-d*t*(.31938153+t*(-.356563782+t*(1.781477937+t*(-1.821255978+t*1.330274429))));return x>=0?p:1-p;}
export function analyzeMatchWinner(game,awayHistory,homeHistory,research,{now=Date.now(),market=null}={}){
  const a=winnerTeamProfile(awayHistory,game.season,game.kickoff,false),h=winnerTeamProfile(homeHistory,game.season,game.kickoff,true);
  const h2h=h.rows.filter(r=>r.opponentId===String(game.awayId)).slice(0,10);
  const warnings=[],reasons=[];
  const{rows:awayRows,...awayPublic}=a,{rows:homeRows,...homePublic}=h;
  const base={...game,status:'PASS',winner:null,awayProfile:awayPublic,homeProfile:homePublic,h2h,h2hHomeWins:h2h.filter(r=>r.win).length,injuries:research?.injuries||[],injuriesAvailable:research?.available===true,reasons,warnings,sourceUrl:`https://www.espn.com/nba/game/_/gameId/${game.id}`};
  const pass=reason=>({...base,reasons:[reason]});
  if(Date.parse(game.kickoff)<=now)return pass('Game has started; pregame winner research is closed.');
  if(a.totalGames<30||h.totalGames<30||a.historicalMargin===null||h.historicalMargin===null)return pass(`Historical coverage is insufficient: ${a.totalGames}/${h.totalGames} verified games. At least 30 per team are needed.`);
  let projection=(h.historicalMargin-a.historicalMargin)*.5+1.5;
  const recentAdj=a.recentGames>=2&&h.recentGames>=2?clamp(((h.recentAverage-a.recentAverage)*.5-(h.historicalMargin-a.historicalMargin)*.5)*.25,-3,3):0;
  const venueAdj=h.venueMargin!==null&&a.venueMargin!==null?clamp(((h.venueMargin-a.venueMargin)-(h.recentAverage-a.recentAverage))*.15,-2,2):0;
  const restAdj=(h.restDays!==null&&h.restDays<1.5?-1:0)-(a.restDays!==null&&a.restDays<1.5?-1:0);
  const h2hAdj=h2h.length>=3?clamp(mean(h2h.map(r=>r.margin))*.08,-1,1):0;
  projection+=recentAdj+venueAdj+restAdj+h2hAdj;
  const mt=Date.parse(market?.marketUpdatedAt);
  const anchored=Number.isFinite(market?.awaySpread)&&market.spreadBooksCount>=2&&Number.isFinite(mt)&&now-mt<8*3600000;
  if(anchored)projection=market.awaySpread+clamp(projection-market.awaySpread,-8,8)*.35;
  const samples=[...a.rows.filter(r=>r.season===game.season).slice(0,10),...h.rows.filter(r=>r.season===game.season).slice(0,10)];
  const sigma=Math.max(14,samples.length>=8?Math.sqrt(mean(samples.map(r=>(r.margin-mean(samples.map(r=>r.margin)))**2))):16);
  const homeProbability=cdf(projection/sigma),pick=projection>=0?game.home:game.away;
  reasons.push(`Three-season scoring-margin comparison: ${game.away} ${a.historicalMargin>0?'+':''}${a.historicalMargin}; ${game.home} ${h.historicalMargin>0?'+':''}${h.historicalMargin} points/game, with more recent seasons weighted more heavily.`);
  reasons.push(`Current-season form: ${game.away} ${a.recentWins}/${a.recentGames} wins; ${game.home} ${h.recentWins}/${h.recentGames}. Recent-form adjustment ${round(recentAdj)} home-margin points.`);
  reasons.push(`Home/away adjustment ${round(venueAdj)}; rest adjustment ${restAdj}. Rest: ${a.restDays??'unknown'}/${h.restDays??'unknown'} days (away/home).`);
  reasons.push(h2h.length?`${game.home} won ${h2h.filter(r=>r.win).length}/${h2h.length} historical meetings shown. Head-to-head margin adjustment ${round(h2hAdj)} points, capped at one point.`:'No verified head-to-head games were found in the three seasons checked.');
  reasons.push(anchored?`Fresh consensus spread anchors the projection: ${game.home} expected margin ${market.awaySpread>0?'+':''}${market.awaySpread}.`:'No fresh consensus spread was available; this projection uses team research only.');
  warnings.push('Beta model: estimated probabilities are uncalibrated, and no out-of-sample accuracy or profitability has been established.');
  warnings.push('Older results involve different rosters and coaches. Team history is context, not proof that the matchup will repeat.');
  warnings.push('Injuries screen unresolved leading-scorer availability; individual injury values and confirmed starting lineups are not modeled.');
  if(Math.min(a.recentGames,h.recentGames)<5)warnings.push('Early-season sample is small; prior seasons have more influence.');
  if(!anchored)warnings.push('Market-odds confirmation is missing. Treat this as a historical model lean.');
  if(!research?.available)return{...base,status:'REVIEW',lean:pick,projectedHomeMargin:round(projection),reasons:[...reasons,'Injury feed is missing or stale. No winner selection is issued.']};
  if(research.unresolvedLeader)return{...base,status:'REVIEW',lean:pick,projectedHomeMargin:round(projection),reasons:[...reasons,'Leading-scorer availability or matchup information is unresolved. No winner selection is issued.']};
  const estimate=round(100*Math.max(homeProbability,1-homeProbability));
  return{...base,status:Math.abs(projection)<1?'CLOSE':'SELECTED',winner:Math.abs(projection)<1?null:pick,lean:pick,winEstimate:estimate,projectedHomeMargin:round(projection),separation:round(Math.abs(projection)),marketAnchored:anchored,marketHomeMargin:anchored?market.awaySpread:null,marketUpdatedAt:anchored?market.marketUpdatedAt:null,reasons};
}
