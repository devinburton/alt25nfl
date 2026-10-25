import{NextResponse}from"next/server";
import{fetchSportOdds}from"../../../../lib/multiSportOdds";
export async function GET(){try{
  const odds=await fetchSportOdds("NBA");
  const upcoming=odds.games.filter(g=>Date.parse(g.kickoff)>Date.now()).sort((a,b)=>Date.parse(a.kickoff)-Date.parse(b.kickoff));
  const day=x=>new Intl.DateTimeFormat("en-CA",{timeZone:"America/New_York"}).format(new Date(x));
  const games=upcoming.filter(g=>day(g.kickoff)===day(upcoming[0].kickoff)).map(g=>({id:g.id,home:g.home,away:g.away,kickoff:g.kickoff}));
  return NextResponse.json({games,fetchedAt:odds.fetchedAt,message:games.length?null:"No upcoming NBA slate is available yet."});
}catch{return NextResponse.json({message:"NBA player-points slate could not load."},{status:502});}}
