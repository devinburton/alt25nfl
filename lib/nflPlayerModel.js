const round=n=>Math.round(n*10)/10;
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const key=s=>String(s||"").normalize('NFD').replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
const number=v=>{if(v===null||v===undefined||String(v).trim()==="")return null;const n=Number(String(v).replaceAll(",",""));return Number.isFinite(n)?n:null;};
export function extractNflTeam(summary,teamId){
  const team=(summary?.boxscore?.players||[]).find(t=>String(t.team?.id)===String(teamId));
  if(!team)return null;
  const players=new Map();let valid=new Set(),rowsValid=true,passParsed=false;
  for(const c of team.statistics||[]){
    if(!['passing','rushing','receiving'].includes(c.name))continue;
    const labels=(c.labels||[]).map(s=>String(s).toUpperCase());
    const idx=name=>labels.indexOf(name),value=(row,name)=>idx(name)>=0?number(row.stats?.[idx(name)]):null;
    if(idx('YDS')<0||idx('TD')<0)continue;
    valid.add(c.name);
    for(const row of c.athletes||[]){
      const a=row.athlete;if(!a?.id||!a.displayName)continue;
      if(value(row,'TD')===null||value(row,'YDS')===null){rowsValid=false;continue;}
      const cur=players.get(String(a.id))||{id:String(a.id),name:a.displayName,passYards:0,passAttempts:0,passTd:0,rushTd:0,receiveTd:0,carries:0,targets:0,receivingYards:0};
      if(c.name==='passing'){
        const attempts=String(row.stats?.[idx('C/ATT')]||'').match(/\d+\s*[-/]\s*(\d+)/);
        if(!attempts){rowsValid=false;continue;}
        passParsed=true;
        cur.passYards+=value(row,'YDS');cur.passAttempts+=Number(attempts[1]);cur.passTd+=value(row,'TD')||0;
      }else if(c.name==='rushing'){cur.rushTd+=value(row,'TD')||0;cur.carries+=value(row,'CAR')||0;}
      else{cur.receiveTd+=value(row,'TD')||0;cur.targets+=value(row,'TGTS')||0;cur.receivingYards+=value(row,'YDS')||0;}
      players.set(cur.id,cur);
    }
  }
  const rows=[...players.values()];
  return{players:rows,complete:valid.size===3&&rowsValid&&passParsed,passYards:rows.reduce((s,p)=>s+p.passYards,0),touchdowns:rows.reduce((s,p)=>s+p.rushTd+p.receiveTd,0)};
}
function healthy(p,injuries){return!injuries.some(i=>(i.id&&i.id===p.id||key(i.player)===key(p.name))&&!/^(active|available|healthy)$/i.test(i.status));}
export function touchdownCandidates({team,roster,games,opponentGames,injuries,injuriesAvailable}){
  if(!injuriesAvailable)return{players:[],reason:'Injury research is unavailable or stale.'};
  const own=games.filter(g=>g.own?.complete),opp=opponentGames.filter(g=>g.opponent?.complete);
  if(own.length<3||opp.length<3)return{players:[],reason:`Need three verified regular-season boxscores per team; available ${own.length}/${opp.length}.`};
  const ownTd=mean(own.map(g=>g.own.touchdowns)),oppAllowed=mean(opp.map(g=>g.opponent.touchdowns));
  const teamExpected=(ownTd+oppAllowed)/2,teamTds=own.reduce((s,g)=>s+g.own.touchdowns,0);
  const players=[];
  for(const p of roster){
    if(!['RB','WR','TE','QB'].includes(p.position)||!healthy(p,injuries))continue;
    const rows=own.map(g=>({date:g.date,id:g.id,opponent:g.opponentName,stats:g.own.players.find(x=>x.id===p.id)||null}));
    const observed=rows.filter(r=>r.stats);
    if(observed.length<2)continue;
    const tds=rows.reduce((s,r)=>s+(r.stats?.rushTd||0)+(r.stats?.receiveTd||0),0),scored=rows.filter(r=>(r.stats?.rushTd||0)+(r.stats?.receiveTd||0)>0).length;
    const carries=mean(rows.map(r=>r.stats?.carries||0)),targets=mean(rows.map(r=>r.stats?.targets||0));
    // QB passing touchdowns are deliberately absent from both the score and history.
    if(carries+targets<3||tds===0)continue;
    const rate=(tds+.5)/(own.length+2),share=(tds+.5)/(teamTds+2);
    const expected=.65*rate+.35*teamExpected*share;
    const score=round(clamp(expected*60+Math.min(carries+targets,25)*.7+scored/own.length*15,0,100));
    players.push({id:p.id,player:p.name,team,position:p.position,score,tds,scoredGames:scored,games:own.length,carries:round(carries),targets:round(targets),opponentTdAllowed:round(oppAllowed),opponentGames:opp.length,history:rows.map(r=>({id:r.id,date:r.date,opponent:r.opponent,rushTd:r.stats?.rushTd??0,receiveTd:r.stats?.receiveTd??0,recorded:Boolean(r.stats)})),reasons:[`${tds} rushing/receiving touchdowns across ${own.length} recent team games; scored in ${scored}/${own.length}.`,`Recent workload: ${round(carries)} carries and ${round(targets)} targets per team game.`,`${team}'s offense averaged ${round(ownTd)} rushing/receiving TDs; opponent allowed ${round(oppAllowed)} across ${opp.length} recent games.`],sourceUrl:`https://www.espn.com/nfl/player/gamelog/_/id/${p.id}`});
  }
  return{players:players.sort((a,b)=>b.score-a.score||b.tds-a.tds).slice(0,3),reason:players.length?null:'No healthy current-roster player meets the recent scoring and workload thresholds.'};
}
export function projectQuarterback({team,starter,roster,games,opponentGames,injuries,injuriesAvailable,weather}){
  const pass=reason=>({status:'PASS',team,reason});
  if(!injuriesAvailable)return pass('Injury research is unavailable or stale.');
  if(!starter)return pass('A current depth-chart QB starter could not be verified.');
  const p=roster.find(p=>p.id===String(starter));
  if(!p||p.position!=='QB')return pass('Listed starter is missing from the active QB roster.');
  if(!healthy(p,injuries))return pass(`${p.name} has an injury designation; starter availability needs confirmation.`);
  const rows=games.map(g=>({date:g.date,id:g.id,opponent:g.opponentName,stats:g.own?.players.find(x=>x.id===p.id)})).filter(r=>r.stats?.passAttempts>=15);
  const opp=opponentGames.filter(g=>g.opponent?.complete);
  if(rows.length<3||opp.length<3)return pass(`${p.name}: need three games with at least 15 attempts and three opponent boxscores; available ${rows.length}/${opp.length}.`);
  const avg=mean(rows.map(r=>r.stats.passYards)),attempts=mean(rows.map(r=>r.stats.passAttempts)),allowed=mean(opp.map(g=>g.opponent.passYards));
  const recent=mean(rows.slice(0,2).map(r=>r.stats.passYards));
  let projection=avg*.55+recent*.15+allowed*.3;
  const weatherPenalty=!weather?.dome&&Number.isFinite(weather?.wind)&&weather.wind>15?clamp((weather.wind-15)*.004,0,.1):0;
  projection*=1-weatherPenalty;
  const uncertainty=Math.max(40,Math.sqrt(mean(rows.map(r=>(r.stats.passYards-avg)**2))));
  return{status:'PROJECTED',id:p.id,player:p.name,team,projectedYards:Math.round(projection),recentAverage:round(avg),attempts:round(attempts),opponentAllowed:round(allowed),sample:rows.length,opponentGames:opp.length,range:[Math.max(0,Math.round(projection-uncertainty)),Math.round(projection+uncertainty)],history:rows.map(r=>({id:r.id,date:r.date,opponent:r.opponent,yards:r.stats.passYards,attempts:r.stats.passAttempts})),reasons:[`${p.name} is listed first at QB on the current depth chart; game-day starter is not independently confirmed.`,`Averaged ${round(avg)} passing yards and ${round(attempts)} attempts in ${rows.length} recent games with at least 15 attempts.`,`Opponent allowed ${round(allowed)} gross passing yards across ${opp.length} recent verified games.`,weatherPenalty?`Wind adjustment reduces projection by ${round(weatherPenalty*100)}%.`:`Weather: ${weather?.label||'unavailable; no weather adjustment applied'}.`],sourceUrl:`https://www.espn.com/nfl/player/gamelog/_/id/${p.id}`};
}
export function compareQuarterbacks(qbs){const valid=qbs.filter(q=>q.status==='PROJECTED').sort((a,b)=>b.projectedYards-a.projectedYards);return{qbs:valid,winner:valid.length===2&&valid[0].projectedYards-valid[1].projectedYards>15?valid[0].player:null,close:valid.length===2&&valid[0].projectedYards-valid[1].projectedYards<=15,passes:qbs.filter(q=>q.status==='PASS')};}
