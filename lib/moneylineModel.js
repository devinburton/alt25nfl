const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

function americanToProb(price){
  if(!Number.isFinite(price))return null;
  return price<0 ? (-price)/((-price)+100) : 100/(price+100);
}
function probToAmerican(p){
  p=clamp(p,.01,.99);
  return p>=.5 ? Math.round(-100*p/(1-p)) : Math.round(100*(1-p)/p);
}
function noVig(homePrice,awayPrice){
  const hp=americanToProb(homePrice),ap=americanToProb(awayPrice);
  if(!Number.isFinite(hp)||!Number.isFinite(ap))return null;
  const s=hp+ap;
  return{home:hp/s,away:ap/s};
}
function marginToWinProb(margin){
  return 1/(1+Math.exp(-margin/6.6));
}

export function analyzeMoneylineGame(g){
  if(!Number.isFinite(g.homeMl)||!Number.isFinite(g.awayMl))return null;
  const market=noVig(g.homeMl,g.awayMl);
  if(!market)return null;

  const marketHomeMargin=6.6*Math.log(market.home/(1-market.home));
  const projectedHomeMargin=Number.isFinite(g.projectedMargin)?g.projectedMargin:marketHomeMargin;
  const modelHome=marginToWinProb(projectedHomeMargin);

  // Strong market anchor; ALT25 context nudges probability rather than replacing market.
  const homeProb=clamp(market.home*.72+modelHome*.28,.03,.97);
  const awayProb=1-homeProb;

  const homeGap=(homeProb-market.home)*100;
  const awayGap=(awayProb-market.away)*100;
  const useHome=homeGap>=awayGap;

  const side=useHome?g.home:g.away;
  const price=useHome?g.homeMl:g.awayMl;
  const marketProb=useHome?market.home:market.away;
  const modelProb=useHome?homeProb:awayProb;
  const gap=(modelProb-marketProb)*100;

  const matchupScore=Math.round(clamp(50+gap*5+(modelProb-.5)*30,0,100));
  const confidence=matchupScore>=78?"High":matchupScore>=60?"Medium":"Low";

  return{
    ...g,
    side,
    price,
    marketProb:+(marketProb*100).toFixed(1),
    modelProb:+(modelProb*100).toFixed(1),
    probabilityGap:+gap.toFixed(1),
    fairPrice:probToAmerican(modelProb),
    matchupScore,
    confidence,
    modelNote:"no-vig market probability • projected scoring margin • home/away + injury context"
  };
}
