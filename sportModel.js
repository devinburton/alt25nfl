function clamp(n,min,max){return Math.max(min,Math.min(max,n))}
function finite(v){return Number.isFinite(v)}

function blendedScoring(away,home){
  const awayBase=(away.pointsFor+home.pointsAllowed)/2;
  const homeBase=(home.pointsFor+away.pointsAllowed)/2;
  return{awayBase,homeBase,raw:awayBase+homeBase};
}

function locationAdjustment(away,home,cap){
  const awayScored=finite(away.awayPoints)?away.awayPoints:away.pointsFor;
  const awayAllowed=finite(away.awayAllowed)?away.awayAllowed:away.pointsAllowed;
  const homeScored=finite(home.homePoints)?home.homePoints:home.pointsFor;
  const homeAllowed=finite(home.homeAllowed)?home.homeAllowed:home.pointsAllowed;
  const loc=((awayScored+homeAllowed)/2)+((homeScored+awayAllowed)/2);
  const base=((away.pointsFor+home.pointsAllowed)/2)+((home.pointsFor+away.pointsAllowed)/2);
  return clamp(loc-base,-cap,cap);
}

function trendAdjustment(away,home,cap){
  if(!finite(away.last3PointsFor)||!finite(home.last3PointsFor))return 0;
  const full=away.pointsFor+home.pointsFor;
  const recent=away.last3PointsFor+home.last3PointsFor;
  return clamp((recent-full)*0.20,-cap,cap);
}

function restAdjustment(away,home,type){
  if(!finite(away.restDays)||!finite(home.restDays))return 0;
  if(type==="basketball"){
    let adj=0;
    if(away.restDays<1.5)adj-=1.0;
    if(home.restDays<1.5)adj-=1.0;
    if(away.restDays>=3)adj+=0.25;
    if(home.restDays>=3)adj+=0.25;
    return adj;
  }
  if(type==="football"){
    return (away.restDays>=8?0.25:0)+(home.restDays>=8?0.25:0);
  }
  return 0;
}

function baseballPitcherAdjustment(ctx){
  if(!ctx)return 0;
  const eras=[ctx.awayStarterEra,ctx.homeStarterEra].filter(finite);
  if(eras.length!==2)return 0;
  const avg=(eras[0]+eras[1])/2;
  // Rough league-average starter ERA anchor; deliberately capped.
  return clamp((avg-4.20)*0.45,-0.8,0.8);
}

export function analyzeSportGame(game,config){
  const market=Number(game.total);
  const away=game.awayProfile;
  const home=game.homeProfile;
  let projection=market;
  let dataQuality=0;
  const notes=[];

  if(away&&home){
    const {raw}=blendedScoring(away,home);
    let signal=raw-market;

    const locAdj=locationAdjustment(away,home,config.modelType==="baseball"?1.0:config.modelType==="basketball"?4:5);
    const trendAdj=trendAdjustment(away,home,config.modelType==="baseball"?0.75:config.modelType==="basketball"?3:4);
    const restAdj=restAdjustment(away,home,config.modelType);
    const pitcherAdj=config.modelType==="baseball"?baseballPitcherAdjustment(game.mlbContext):0;
    const contextAdj=Number(game.seasonContextEffect?.adjustment)||0;

    signal+=locAdj*0.35;
    signal+=trendAdj;
    signal+=restAdj;
    signal+=pitcherAdj;
    signal+=contextAdj;

    signal=clamp(signal,-config.edgeCap,config.edgeCap);

    // Market anchor remains intentionally strong.
    const weight=config.modelType==="baseball"?0.48:config.modelType==="basketball"?0.52:0.55;
    projection=market+(signal*weight);

    const minGames=Math.min(away.games||0,home.games||0);
    dataQuality=clamp(minGames/config.recentGames,0,1);

    notes.push(`form total ${raw.toFixed(1)}`);
    if(Math.abs(locAdj)>=0.1)notes.push(`home/away ${locAdj>=0?"+":""}${locAdj.toFixed(1)}`);
    if(Math.abs(trendAdj)>=0.1)notes.push(`recent trend ${trendAdj>=0?"+":""}${trendAdj.toFixed(1)}`);
    if(Math.abs(restAdj)>=0.1)notes.push(`rest ${restAdj>=0?"+":""}${restAdj.toFixed(1)}`);
    if(config.modelType==="baseball"&&game.mlbContext){
      const a=finite(game.mlbContext.awayStarterEra)?game.mlbContext.awayStarterEra.toFixed(2):"—";
      const h=finite(game.mlbContext.homeStarterEra)?game.mlbContext.homeStarterEra.toFixed(2):"—";
      notes.push(`starter ERA ${a}/${h}`);
    }
    if(game.seasonContextEffect?.label){
      notes.push(game.seasonContextEffect.label);
    }
  }else{
    notes.push("limited recent sample");
  }

  const edge=projection-market;
  const side=edge>=0?"OVER":"UNDER";
  const altLine=side==="OVER"?market-2.5:market+2.5;
  const abs=Math.abs(edge);

  const volatility=[away?.totalVolatility,home?.totalVolatility].filter(finite);
  const vol=volatility.length?volatility.reduce((a,b)=>a+b,0)/volatility.length:null;
  let stabilityBonus=0;
  if(finite(vol)){
    if(config.modelType==="baseball")stabilityBonus=clamp(8-vol*1.1,0,8);
    else if(config.modelType==="basketball")stabilityBonus=clamp(8-vol*0.25,0,8);
    else stabilityBonus=clamp(8-vol*0.30,0,8);
  }

  const edgeComponent=clamp(abs/config.edgeScale,0,1)*60;
  const qualityComponent=dataQuality*22;
  const marketComponent=clamp((game.booksCount||0)/10,0,1)*10;
  const contextPenalty=Number(game.seasonContextEffect?.confidencePenalty)||0;
  const hotScore=Math.round(clamp(edgeComponent+qualityComponent+marketComponent+stabilityBonus-contextPenalty,0,100));

  const confidence=hotScore>=78?"High":hotScore>=60?"Medium":"Low";

  return{
    ...game,
    projected:+projection.toFixed(1),
    edge:+edge.toFixed(1),
    side,
    altLine:+altLine.toFixed(1),
    confidence,
    hotScore,
    dataQuality:+dataQuality.toFixed(2),
    modelVersion:`${config.modelType}-v2`,
    modelNote:notes.join(" • ")
  };
}
