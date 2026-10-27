import{NextResponse}from'next/server';
import{fetchSportOdds}from'../../../../lib/multiSportOdds';
import{getNbaResearch}from'../../../../lib/nbaResearch';
import{winnerSlate,winnerHistory,winnerMarket}from'../../../../lib/nbaWinnerData';
import{analyzeMatchWinner}from'../../../../lib/nbaWinnerModel';
export const maxDuration=60;
export async function GET(){try{
  const slate=await winnerSlate();
  if(!slate.length)return NextResponse.json({status:'WAITING',games:[],message:'No upcoming NBA slate is available yet.'});
  const[research,odds]=await Promise.all([getNbaResearch(slate),fetchSportOdds('NBA').catch(()=>({games:[],fetchedAt:null}))]);
  const games=[];
  for(let i=0;i<slate.length;i+=3){games.push(...await Promise.all(slate.slice(i,i+3).map(async g=>{
    const[a,h]=await Promise.all([winnerHistory(g.awayId,g.season,g.kickoff),winnerHistory(g.homeId,g.season,g.kickoff)]);
    return analyzeMatchWinner(g,a,h,research.get(g.id),{market:winnerMarket(g,odds.games)});
  })));}
  const selected=games.filter(g=>g.status==='SELECTED').sort((a,b)=>b.winEstimate-a.winEstimate);
  const topId=selected[0]?.id||null;
  return NextResponse.json({status:'ACTIVE',games:games.map(g=>({...g,topPick:g.id===topId})),topPick:topId,updatedAt:new Date().toISOString(),oddsFetchedAt:odds.fetchedAt,modelVersion:'nba-winners-v1-beta',historySeasons:[slate[0].season,slate[0].season-1,slate[0].season-2]},{headers:{'Cache-Control':'no-store'}});
}catch{return NextResponse.json({message:'NBA winner research could not finish. Please try again shortly.',games:[]},{status:502});}}
