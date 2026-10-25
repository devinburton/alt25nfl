import{teamResults}from"./nbaDogTotalModel.js";
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const mean=a=>a.reduce((s,x)=>s+x,0)/a.length;
const round=n=>Math.round(n*10)/10;
export function decimalOdds(n){return Number.isFinite(n)&&Math.abs(n)>=100?(n>0?1+n/100:1+100/Math.abs(n)):null;}
// Standard normal CDF approximation; estimates remain uncalibrated.
function cdf(x){const z=Math.abs(x),t=1/(1+.2316419*z),d=.3989422804014327*Math.exp(-z*z/2);const p=1-d*t*(.319381530+t*(-.356563782+t*(1.781477937+t*(-1.821255978+t*1.330274429))));return x>=0?p:1-p;}
export function spreadProbabilities(margin,line,sigma){
  const pushLine=Number.isInteger(line);
  const win=1-cdf((-line+(pushLine?.5:0)-margin)/sigma);
  const loss=cdf((-line-(pushLine?.5:0)-margin)/sigma);
  return{win,loss,push:Math.max(0,1-win-loss)};
}
export function analyzeNbaSpread(game,history,research,{now=Date.now(),oddsFetchedAt}={}){
  const awayRows=teamResults(game.away,history,game.kickoff),homeRows=teamResults(game.home,history,game.kickoff);
  const base={id:game.id,away:game.away,home:game.home,kickoff:game.kickoff,status:"PASS",reasons:[],awayGames:awayRows.length,homeGames:homeRows.length,injuries:research?.injuries||[],injuriesAvailable:research?.available===true,sourceUrl:research?.sourceUrl||null,marketUpdatedAt:game.marketUpdatedAt};
  const pass=reason=>({...base,reasons:[reason]});
  if(Date.parse(game.kickoff)<=now)return pass("Game has started; pregame spread research is closed.");
  if(!Number.isFinite(game.awaySpread)||game.spreadBooksCount<2)return pass("Waiting for a consensus spread from at least two books.");
  const fetched=Date.parse(oddsFetchedAt),marketTime=Date.parse(game.marketUpdatedAt);
  if(!Number.isFinite(fetched)||!Number.isFinite(marketTime)||now-fetched>8*3600000||now-marketTime>8*3600000)return pass("Spread market snapshot is missing or over eight hours old.");
  if(Math.min(awayRows.length,homeRows.length)<4)return pass(`Need four recent regular-season games per team; available ${awayRows.length}/${homeRows.length}. Preseason is excluded.`);
  if(!research?.available)return pass("Injury research is unavailable or stale.");
  if(research.unresolvedLeader)return pass("A leading scorer has an unresolved injury designation, or matchup research is incomplete.");
  const a=game.awayProfile,h=game.homeProfile;
  if(!a||!h||![a.pointsFor,a.pointsAllowed,h.pointsFor,h.pointsAllowed].every(Number.isFinite))return pass("Recent scoring profiles are incomplete.");
  const rawAway=(a.pointsFor+h.pointsAllowed)/2,rawHome=(h.pointsFor+a.pointsAllowed)/2;
  const locAway=((a.awayPoints??a.pointsFor)+(h.homeAllowed??h.pointsAllowed))/2;
  const locHome=((h.homePoints??h.pointsFor)+(a.awayAllowed??a.pointsAllowed))/2;
  const location=clamp(((locHome-locAway)-(rawHome-rawAway))*.25,-2,2);
  const fatigue=(Number.isFinite(h.restDays)&&h.restDays<1.5?-1:0)-(Number.isFinite(a.restDays)&&a.restDays<1.5?-1:0);
  const marketMargin=game.awaySpread;
  const weight=.4*Math.min(1,Math.min(awayRows.length,homeRows.length)/10);
  const projection=marketMargin+clamp(rawHome-rawAway+location+fatigue-marketMargin,-8,8)*weight;
  const homePick=projection>marketMargin,team=homePick?game.home:game.away;
  const line=homePick?-game.awaySpread:game.awaySpread,margin=homePick?projection:-projection;
  const edge=margin+line;
  if(edge<1.5)return pass(`Model edge ${round(edge)} points is below the 1.5-point research threshold.`);
  // Exact consensus line only; never attach an unrelated sportsbook price.
  const quotes=(game.spreadQuotes||[]).filter(q=>q.team===team&&Math.abs(q.line-line)<.01&&decimalOdds(q.price)&&Number.isFinite(Date.parse(q.updatedAt))&&now-Date.parse(q.updatedAt)<8*3600000).sort((a,b)=>decimalOdds(b.price)-decimalOdds(a.price));
  if(!quotes.length)return pass("No fresh sportsbook quote matches the selected consensus line exactly.");
  const quote=quotes[0];
  const residuals=[...awayRows.map(r=>r.margin-mean(awayRows.map(x=>x.margin))),...homeRows.map(r=>r.margin-mean(homeRows.map(x=>x.margin)))];
  const sigma=Math.max(14,Math.sqrt(residuals.reduce((s,x)=>s+x*x,0)/Math.max(1,residuals.length-2)));
  const p=spreadProbabilities(margin,line,sigma),decimal=decimalOdds(quote.price);
  const expectedReturn=p.win*(decimal-1)-p.loss;
  if(expectedReturn<.02)return pass(`Available price ${quote.price>0?"+":""}${quote.price} does not clear the beta model’s 2% estimated-return threshold.`);
  const fairDecimal=1+p.loss/p.win;
  const quality=Math.min(1,Math.min(awayRows.length,homeRows.length)/10);
  const score=round(clamp(edge/3.2*50+quality*30+Math.min(game.spreadBooksCount,10)*2,0,100));
  return{...base,status:"CANDIDATE",team,line,price:quote.price,book:quote.book,quotedAt:quote.updatedAt,edge:round(edge),projectedHomeMargin:round(projection),coverProbability:round(p.win*100),pushProbability:round(p.push*100),expectedReturn:round(expectedReturn*100),fairDecimal:Math.round(fairDecimal*100)/100,score,rest:{away:a.restDays,home:h.restDays},reasons:[`Scoring matchup implies a home margin of ${round(rawHome-rawAway)}; market expects ${round(marketMargin)}. Projection remains anchored to market at ${round(projection)}.`,`Home/away scoring adjustment ${round(location)} points; rest adjustment ${fatigue} points.`,`${team} ${line>0?"+":""}${line} at ${quote.book}: ${quote.price>0?"+":""}${quote.price}. Price is from the displayed market snapshot.`],warnings:["Research beta: probabilities and expected returns are uncalibrated; no historical betting edge has been established.","Injuries screen uncertain matchups; player scoring impacts are not invented. Starting lineups are not confirmed.",...(quality<.8?["Small current-season sample; market receives most of the projection weight."]:[])]};
}
