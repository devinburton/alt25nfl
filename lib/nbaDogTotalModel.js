// Uncalibrated research model. Joint outcomes share correlated margin/total draws.
// Cushion targets are model suggestions, never claims of available sportsbook lines.
export const MODEL_VERSION="dog-total-v1-beta";
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const mean=a=>a.reduce((s,x)=>s+x,0)/a.length;
const sd=a=>a.length>1?Math.sqrt(a.reduce((s,x)=>s+(x-mean(a))**2,0)/(a.length-1)):0;
const norm=s=>String(s||"").toLowerCase().replace(/[^a-z0-9]/g,"");
const half=n=>Math.round(n)+0.5;
const round=n=>Math.round(n*10)/10;

export function teamResults(team,history,kickoff,limit=10){
  return history.filter(g=>g.completed&&g.seasonType===2&&Number.isFinite(g.homeScore)&&Number.isFinite(g.awayScore)&&new Date(g.kickoff)<new Date(kickoff)&&(norm(g.home)===norm(team)||norm(g.away)===norm(team)))
    .sort((a,b)=>new Date(b.kickoff)-new Date(a.kickoff)).slice(0,limit)
    .map(g=>{const home=norm(g.home)===norm(team);return{id:g.id,kickoff:g.kickoff,margin:home?g.homeScore-g.awayScore:g.awayScore-g.homeScore,total:g.homeScore+g.awayScore};});
}

// Seeded Gaussian simulation makes identical source snapshots reproducible.
export function jointSamples(rows,projectedMargin,projectedTotal,seed=25){
  const margins=rows.map(x=>x.margin),totals=rows.map(x=>x.total);
  const m=mean(margins),t=mean(totals);
  const rawM=sd(margins),rawT=sd(totals);
  const cov=rows.length>1?rows.reduce((s,x)=>s+(x.margin-m)*(x.total-t),0)/(rows.length-1):0;
  const rho=clamp((rawM&&rawT?cov/(rawM*rawT):0)*rows.length/(rows.length+20),-.65,.65);
  // Conservative variance floors prevent tiny samples from looking certain.
  const marginSd=Math.max(14,rawM),totalSd=Math.max(19,rawT);
  let state=seed>>>0;
  const uniform=()=>{state=(Math.imul(1664525,state)+1013904223)>>>0;return(state+1)/4294967297;};
  const draws=[];
  for(let i=0;i<6000;i++){
    const r=Math.sqrt(-2*Math.log(uniform())),theta=2*Math.PI*uniform();
    const z1=r*Math.cos(theta),z2=r*Math.sin(theta);
    draws.push({margin:projectedMargin+marginSd*z1,total:projectedTotal+totalSd*(rho*z1+Math.sqrt(1-rho*rho)*z2)});
  }
  return{draws,rho:round(rho),marginSd:round(marginSd),totalSd:round(totalSd)};
}

export function evaluatePair(draws,spread,total,direction){
  let both=0,spreadHits=0,totalHits=0;
  for(const d of draws){const s=d.margin+spread>0,t=direction==="OVER"?d.total>total:d.total<total;if(s)spreadHits++;if(t)totalHits++;if(s&&t)both++;}
  return{jointProbability:round(100*both/draws.length),spreadProbability:round(100*spreadHits/draws.length),totalProbability:round(100*totalHits/draws.length)};
}

export function analyzeDogTotal(game,history,research,{now=Date.now(),oddsFetchedAt}={}){
  const a=teamResults(game.away,history,game.kickoff),h=teamResults(game.home,history,game.kickoff);
  const awayDog=Number.isFinite(game.awaySpread)&&game.awaySpread>0;
  const dog=awayDog?game.away:game.home;
  const marketSpread=Number.isFinite(game.awaySpread)?Math.abs(game.awaySpread):null;
  const dogRows=awayDog?a:h,oppRows=awayDog?h:a;
  const warnings=[],reasons=[];
  const base={id:game.id,away:game.away,home:game.home,kickoff:game.kickoff,dog,marketSpread,marketTotal:game.total,status:"PASS",reasons,warnings,modelVersion:MODEL_VERSION,oddsFetchedAt,marketUpdatedAt:game.marketUpdatedAt,injuries:research?.injuries||[],injuriesAvailable:research?.available===true,sourceUrl:research?.sourceUrl||null,awayGames:a.length,homeGames:h.length,awayProfile:game.awayProfile,homeProfile:game.homeProfile};
  if(new Date(game.kickoff).getTime()<=now){reasons.push("Game has started; pregame model closed.");return base;}
  if(!Number.isFinite(game.awaySpread)||marketSpread===0||!Number.isFinite(game.total)||game.spreadBooksCount<2||game.booksCount<2){reasons.push("Waiting for a non-pick'em spread and totals from at least two books.");return base;}
  const fetched=Date.parse(oddsFetchedAt),marketTime=Date.parse(game.marketUpdatedAt);
  if(!Number.isFinite(fetched)||!Number.isFinite(marketTime)||now-fetched>8*3600000||now-marketTime>8*3600000){reasons.push("Market snapshot is missing or over eight hours old.");return base;}
  if(a.length<4||h.length<4){reasons.push(`Need at least four recent regular-season games per team; available ${a.length}/${h.length}. Preseason results are excluded.`);return base;}
  if(!research?.available){reasons.push("Injury research unavailable; waiting for a verified feed.");return base;}
  if(research.unresolvedLeader){reasons.push("A leading scorer has an unresolved injury designation; wait for an update.");return base;}
  if(!Number.isFinite(game.projected)||Math.abs(game.projected-game.total)<1.5){reasons.push("No clear total direction: model differs from market by less than 1.5 points.");return base;}
  const direction=game.projected>game.total?"OVER":"UNDER";
  const sampleWeight=Math.min(a.length,h.length,10)/10;
  const empiricalMargin=(mean(dogRows.map(x=>x.margin))-mean(oppRows.map(x=>x.margin)))/2;
  const location=awayDog?-1.5:1.5;
  const dogRest=awayDog?game.awayProfile?.restDays:game.homeProfile?.restDays;
  const oppRest=awayDog?game.homeProfile?.restDays:game.awayProfile?.restDays;
  const rest=(Number.isFinite(dogRest)&&dogRest<1.5?-1:0)-(Number.isFinite(oppRest)&&oppRest<1.5?-1:0);
  const projectedMargin=-marketSpread+clamp(empiricalMargin+location+rest+marketSpread,-6,6)*.35*sampleWeight;
  // Opponent margins are reversed into the selected underdog's perspective.
  // Deduplicate head-to-head games to avoid overstating sample size.
  const paired=new Map();
  for(const r of dogRows)paired.set(r.id,r);
  for(const r of oppRows)if(!paired.has(r.id))paired.set(r.id,{...r,margin:-r.margin});
  const rows=[...paired.values()];
  const simulation=jointSamples(rows,projectedMargin,game.projected);
  let choice=null;
  for(const s of [6,8,10,12,15])for(const t of [8,10,12,15]){
    const spread=half(marketSpread+s-.5),total=half(game.total+(direction==="OVER"?-t:t)-.5);
    const result=evaluatePair(simulation.draws,spread,total,direction);
    if(result.jointProbability<68||result.spreadProbability<78||result.totalProbability<78)continue;
    const cost=spread-marketSpread+Math.abs(total-game.total);
    if(!choice||cost<choice.cost)choice={...result,spread,total,cost};
  }
  if(!choice){reasons.push("No pair meets the research thresholds within the allowed cushion range.");return base;}
  const historical=rows.filter(r=>r.margin+choice.spread>0&&(direction==="OVER"?r.total>choice.total:r.total<choice.total)).length;
  warnings.push("Beta estimates are uncalibrated; historical testing has not established a betting edge.");
  warnings.push("Alternate lines are model targets. Confirm availability and the combined SGP price at your sportsbook.");
  if(Math.min(a.length,h.length)<8)warnings.push("Small current-season sample; projections remain strongly anchored to the market.");
  if(research.injuries.length)warnings.push("Reported injuries are shown below. No invented player-value adjustment is applied; market lines remain the anchor.");
  reasons.push(`${dog} gets ${round(choice.spread-marketSpread)} extra points beyond the consensus +${marketSpread}.`);
  reasons.push(`Projected total ${game.projected} vs market ${game.total}; ${direction} target adds ${round(Math.abs(choice.total-game.total))} points of cushion.`);
  reasons.push(`Recent form, home/away scoring and rest: ${game.modelNote||"market-anchored scoring model"}.`);
  return{...base,status:"RESEARCH",direction,altSpread:choice.spread,altTotal:choice.total,spreadCushion:round(choice.spread-marketSpread),totalCushion:round(Math.abs(choice.total-game.total)),projectedTotal:game.projected,projectedDogMargin:round(projectedMargin),jointProbability:choice.jointProbability,spreadProbability:choice.spreadProbability,totalProbability:choice.totalProbability,correlation:simulation.rho,sampleSize:rows.length,historicalBoth:{hits:historical,games:rows.length},fairDecimal:Math.round(100/choice.jointProbability*100)/100,bookPrice:null,rest:{away:game.awayProfile?.restDays,home:game.homeProfile?.restDays},researchScore:round(choice.jointProbability*Math.min(1,Math.min(a.length,h.length)/8))};
}
