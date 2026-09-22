function clamp(n,min,max){return Math.max(min,Math.min(max,n))}

export function analyzeSportGame(game,config){
  const market=Number(game.total);
  const away=game.awayProfile;
  const home=game.homeProfile;
  let projection=market;
  let dataQuality=0;
  const notes=[];

  if(away&&home){
    const awayPts=(away.pointsFor+home.pointsAllowed)/2;
    const homePts=(home.pointsFor+away.pointsAllowed)/2;
    const raw=awayPts+homePts;

    // Anchor strongly to the market and use team form as the directional signal.
    const diff=clamp(raw-market,-config.edgeCap,config.edgeCap);
    projection=market+(diff*0.55);

    const minGames=Math.min(away.games||0,home.games||0);
    dataQuality=clamp(minGames/config.recentGames,0,1);

    notes.push(`recent scoring model ${raw.toFixed(1)}`);

    const awayLoc=Number.isFinite(away.awayPoints)?away.awayPoints:away.pointsFor;
    const homeLoc=Number.isFinite(home.homePoints)?home.homePoints:home.pointsFor;
    const locRaw=awayLoc+homeLoc;
    if(Number.isFinite(locRaw)){
      const locDiff=clamp(locRaw-raw,-config.edgeCap/2,config.edgeCap/2);
      projection+=locDiff*0.12;
      notes.push(`home/away ${locDiff>=0?"+":""}${(locDiff*0.12).toFixed(1)}`);
    }
  }else{
    notes.push("limited recent sample");
  }

  const edge=projection-market;
  const side=edge>=0?"OVER":"UNDER";
  const altLine=side==="OVER"?market-2.5:market+2.5;
  const abs=Math.abs(edge);

  const edgeComponent=clamp(abs/config.edgeScale,0,1)*65;
  const qualityComponent=dataQuality*25;
  const marketComponent=clamp((game.booksCount||0)/10,0,1)*10;
  const hotScore=Math.round(clamp(edgeComponent+qualityComponent+marketComponent,0,100));

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
    modelNote:notes.join(" • ")
  };
}
