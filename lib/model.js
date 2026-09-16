const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));const ok=v=>Number.isFinite(v);

function weatherAdj(w){
  if(!w||w.dome)return 0;
  let a=0,wind=Number(w.wind||0),temp=Number(w.temp||70),p=Number(w.precip||0);
  if(wind>=20)a-=3.5;else if(wind>=15)a-=2.25;else if(wind>=12)a-=1.25;
  if(p>=70)a-=1;else if(p>=45)a-=.5;
  if(temp<=32)a-=.75;if(temp>=93)a-=.35;
  return a
}

function comp(name,v,w,notes){
  if(!ok(v))return 0;
  const c=v*w;
  notes.push(`${name} ${c>=0?"+":""}${c.toFixed(1)}`);
  return c
}

function dataQuality(a,h,g){
  let available=0,total=0;
  const checks=[
    a?.pointsFor,h?.pointsFor,a?.pointsAllowed,h?.pointsAllowed,
    a?.ypp,h?.ypp,a?.oppYpp,h?.oppYpp,
    a?.plays,h?.plays,a?.redPct,h?.redPct,
    a?.thirdPct,h?.thirdPct,a?.explosive,h?.explosive,
    a?.turnovers,h?.turnovers
  ];
  for(const v of checks){total++;if(ok(v))available++}
  let q=total?available/total:0;
  if((g.booksCount||0)>=8)q+=.06;
  else if((g.booksCount||0)>=5)q+=.03;
  if((a?.games||0)>=3&&(h?.games||0)>=3)q+=.08;
  else if((a?.games||0)>=2&&(h?.games||0)>=2)q+=.04;
  return clamp(q,0,1);
}

function hotScore(edge,quality,g){
  // Ranking score, not a calibrated win probability.
  const edgePart=clamp(Math.abs(edge)/6,0,1)*58;
  const qualityPart=quality*27;
  const marketPart=clamp((g.booksCount||0)/10,0,1)*10;
  const weatherCert=g.weather?.label==="Weather pending"||g.weather?.label==="Weather unavailable"?0:5;
  return Math.round(clamp(edgePart+qualityPart+marketPart+weatherCert,0,100));
}

export function analyzeGame(g){
  const market=Number(g.total),a=g.awayProfile,h=g.homeProfile,notes=[];
  let adj=0;

  if(a&&h){
    const scoring=((a.pointsFor+h.pointsAllowed)/2)+((h.pointsFor+a.pointsAllowed)/2);
    adj+=comp("scoring",clamp(scoring-market,-10,10),.30,notes);

    if(ok(a.ypp)&&ok(h.ypp)&&ok(a.oppYpp)&&ok(h.oppYpp)){
      const sig=((a.ypp+h.ypp)/2)-((a.oppYpp+h.oppYpp)/2);
      adj+=comp("efficiency",clamp(sig,-2,2),1.35,notes)
    }

    if(ok(a.plays)&&ok(h.plays))
      adj+=comp("pace",clamp(((a.plays+h.plays)/2)-63,-8,8),.18,notes);

    if(ok(a.redPct)&&ok(h.redPct))
      adj+=comp("red zone",clamp(((a.redPct+h.redPct)/2)-.55,-.25,.25),4.0,notes);

    if(ok(a.thirdPct)&&ok(h.thirdPct))
      adj+=comp("3rd down",clamp(((a.thirdPct+h.thirdPct)/2)-.40,-.2,.2),3.0,notes);

    if(ok(a.explosive)&&ok(h.explosive))
      adj+=comp("explosive",clamp(((a.explosive+h.explosive)/2)-3.0,-2,3),.35,notes);

    if(ok(a.turnovers)&&ok(h.turnovers))
      adj+=comp("turnovers",clamp(((a.turnovers+h.turnovers)/2)-1.3,-1.5,1.5),-.45,notes);

    const loc=((ok(a.awayPoints)?a.awayPoints:a.pointsFor)+(ok(h.homePoints)?h.homePoints:h.pointsFor))-(a.pointsFor+h.pointsFor);
    adj+=comp("home/away",clamp(loc,-6,6),.12,notes)
  } else notes.push("limited early-season sample");

  const w=weatherAdj(g.weather);
  adj+=w;
  notes.push(w===0?(g.weather?.dome?"indoor weather neutral":"weather neutral"):`weather ${w.toFixed(1)}`);

  const inj=(g.awayInjury?.totalAdjustment||0)+(g.homeInjury?.totalAdjustment||0);
  if(inj>0){adj-=inj;notes.push(`injuries -${inj.toFixed(1)}`)}

  adj=clamp(adj,-7.5,7.5);
  const projected=market+adj,edge=projected-market,side=edge>=0?"OVER":"UNDER";
  const alt=side==="OVER"?market-2.5:market+2.5;
  const abs=Math.abs(edge);
  const confidence=abs>=4.25?"High":abs>=2.25?"Medium":"Low";
  const quality=dataQuality(a,h,g);
  const hot=hotScore(edge,quality,g);

  return{
    ...g,
    projected:+projected.toFixed(1),
    edge:+edge.toFixed(1),
    side,
    altLine:+alt.toFixed(1),
    confidence,
    dataQuality:+quality.toFixed(2),
    hotScore:hot,
    modelNote:notes.join(" • ")
  }
}
