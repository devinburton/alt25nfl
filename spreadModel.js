const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const finite=v=>Number.isFinite(v);

function quality(a,h,books){
  let q=0;
  if(a&&h){
    q+=.45;
    if((a.games||0)>=3&&(h.games||0)>=3)q+=.15;
    if(finite(a.pointsFor)&&finite(a.pointsAllowed)&&finite(h.pointsFor)&&finite(h.pointsAllowed))q+=.15;
    if(finite(a.homePoints)||finite(a.awayPoints)||finite(h.homePoints)||finite(h.awayPoints))q+=.10;
  }
  q+=clamp((books||0)/10,0,1)*.15;
  return clamp(q,0,1);
}

export function analyzeSpreadGame(g){
  const a=g.awayProfile,h=g.homeProfile;
  if(!a||!h||!finite(g.homeSpread)||!finite(g.awaySpread))return null;

  const marketMargin=-g.homeSpread; // positive means market expects home to win by this much.

  const awayPts=((a.pointsFor||0)+(h.pointsAllowed||0))/2;
  const homePts=((h.pointsFor||0)+(a.pointsAllowed||0))/2;

  let rawMargin=homePts-awayPts;

  // Use actual location splits when available, otherwise small home-field nudge.
  const homeLoc=finite(h.homePoints)?h.homePoints-h.pointsFor:1.25;
  const awayLoc=finite(a.awayPoints)?a.awayPoints-a.pointsFor:0;
  rawMargin+=clamp((homeLoc-awayLoc)*.25,-2,2);

  // Injuries: more home injury pressure lowers the expected home margin.
  const homeInj=g.homeInjury?.totalAdjustment||0;
  const awayInj=g.awayInjury?.totalAdjustment||0;
  rawMargin+=clamp((awayInj-homeInj)*1.15,-2.5,2.5);

  // Strong market anchor with capped disagreement.
  const disagreement=clamp(rawMargin-marketMargin,-7,7);
  const projectedMargin=marketMargin+disagreement*.42;

  const homeCoverEdge=projectedMargin-marketMargin;
  const side=homeCoverEdge>=0?g.home:g.away;
  const marketLine=side===g.home?g.homeSpread:g.awaySpread;
  const edge=Math.abs(homeCoverEdge);
  const altLine=marketLine+2.5;

  const q=quality(a,h,g.booksCount);
  const matchupScore=Math.round(clamp(
    clamp(edge/4.5,0,1)*60+
    q*25+
    clamp((g.booksCount||0)/10,0,1)*15,
    0,100
  ));

  const confidence=matchupScore>=78?"High":matchupScore>=60?"Medium":"Low";

  return{
    ...g,
    side,
    marketLine:+marketLine.toFixed(1),
    altLine:+altLine.toFixed(1),
    projectedMargin:+projectedMargin.toFixed(1),
    edge:+edge.toFixed(1),
    matchupScore,
    confidence,
    modelNote:`market anchored • recent scoring margin • home/away context • injury context`
  };
}
