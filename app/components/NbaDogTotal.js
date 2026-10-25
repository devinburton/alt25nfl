"use client";
import{useEffect,useState}from"react";
const one=v=>Number.isFinite(v)?v.toFixed(1):"—";
const fmt=v=>v?new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}).format(new Date(v))+" ET":"Pending";
export function decimalFromAmerican(value){
  if(!String(value).trim())return null;
  const n=Number(value);return Number.isFinite(n)&&Math.abs(n)>=100?(n>0?1+n/100:1+100/Math.abs(n)):null;
}
function DogCard({g,selected,onToggle}){
  const[price,setPrice]=useState("");
  const decimal=decimalFromAmerican(price),p=g.jointProbability/100;
  const edge=decimal?p*decimal-1:null;
  const pick=g.status==="RESEARCH";
  return <article className={`gameCard dogCard ${pick?"isHot":"dogPass"}`}>
    <div className="cardHead"><div className="cardHeadMain"><div className="kickoff">{fmt(g.kickoff)}</div><h3>{g.away} <span>@</span> {g.home}</h3><div className="cardBadges"><span className={`pill ${pick?"emphasis":""}`}>{pick?"MODEL CANDIDATE":"PASS"}</span>{pick&&<span className="pill">PRICE CHECK NEEDED</span>}</div></div></div>
    {pick?<>
      <div className="dogLegs"><div><span>01 · UNDERDOG ALT SPREAD</span><strong>{g.dog} +{one(g.altSpread)}</strong><small>Market +{one(g.marketSpread)} · +{one(g.spreadCushion)} cushion</small></div><div><span>02 · ALT TOTAL</span><strong>{g.direction} {one(g.altTotal)}</strong><small>Market {one(g.marketTotal)} · {one(g.totalCushion)} cushion</small></div></div>
      <div className="numbersRow"><div><span>Both hit · estimate</span><strong>{one(g.jointProbability)}%</strong></div><div><span>Projected total</span><strong>{one(g.projectedTotal)}</strong></div><div><span>Recent games</span><strong>{g.awayGames} / {g.homeGames}</strong></div><div><span>Fair decimal · model</span><strong>{g.fairDecimal.toFixed(2)}</strong></div></div>
      <div className="dogPrice"><label htmlFor={`price-${g.id}`}>Your book’s combined 2-leg SGP odds</label><input id={`price-${g.id}`} placeholder="e.g. -150 or +110" value={price} onChange={e=>setPrice(e.target.value)} inputMode="text" autoComplete="off"/><p aria-live="polite">{decimal?(edge>0?`Price clears the beta model threshold (${one(edge*100)}% estimated return). Estimate is unvalidated.`:"PASS at this price — payout falls below the beta model’s fair-price estimate."):price?"Enter valid American odds: -100 or lower, +100 or higher.":"No sportsbook quote connected. Enter the actual SGP price to compare it with the model."}</p></div>
      <button type="button" className={`dogSelect ${selected?"selected":""}`} aria-pressed={selected} onClick={()=>onToggle(g)}>{selected?"✓ Added to builder":"+ Add research pair"}</button>
    </>:<div className="dogPassReason">{g.reasons.join(" ")}</div>}
    <details className="why"><summary>{pick?"Research & risks":"Research status"}</summary><div className="whyBody">
      {pick&&g.reasons.map((r,i)=><p key={i}>{r}</p>)}
      {pick&&<p><strong>Both-hit history:</strong> {g.historicalBoth.hits}/{g.historicalBoth.games} recent team-game observations cleared these target thresholds. Opponent margins are reversed. This is descriptive, includes different opponents, and is not a backtest.</p>}
      {pick&&<p>Rest entering matchup: {g.away} {one(g.rest.away)} days · {g.home} {one(g.rest.home)} days.</p>}
      <p><strong>Injury feed:</strong> {g.injuriesAvailable?"Checked; expected starting lineups are not confirmed.":"Unavailable or stale."}</p>
      {g.injuries.map((i,n)=><p key={n}><strong>{i.player} · {i.team} · {i.status}</strong>{i.note?` — ${i.note}`:""}</p>)}
      {g.injuriesAvailable&&!g.injuries.length&&<p>No injuries listed for these teams in the retrieved feed.</p>}
      {g.warnings.map((w,i)=><p className="dogRisk" key={i}>{w}</p>)}
      <p>No separate possession-pace or travel-distance model is included in this beta.</p>
      {g.sourceUrl&&<a href={g.sourceUrl} target="_blank" rel="noreferrer">Open ESPN matchup research ↗</a>}
    </div></details>
  </article>;
}
export default function NbaDogTotal(){
  const[board,setBoard]=useState(null),[error,setError]=useState(""),[selected,setSelected]=useState([]),[retry,setRetry]=useState(0),[copied,setCopied]=useState(false);
  useEffect(()=>{
    const controller=new AbortController();
    setError("");setBoard(null);setSelected([]);
    fetch("/api/nba/dog-total",{cache:"no-store",signal:controller.signal}).then(async r=>{const b=await r.json();if(!r.ok)throw new Error(b.message||"NBA research could not load.");return b;}).then(setBoard).catch(e=>{if(e.name!=="AbortError")setError(e.message);});
    return()=>controller.abort();
  },[retry]);
  const toggle=g=>{setCopied(false);setSelected(prev=>prev.some(x=>x.id===g.id)?prev.filter(x=>x.id!==g.id):[...prev,g]);};
  const copy=async()=>{try{await navigator.clipboard.writeText(selected.map(g=>`${g.away} @ ${g.home}: ${g.dog} +${g.altSpread} / ${g.direction} ${g.altTotal}`).join("\n"));setCopied(true);}catch{setCopied(false);}};
  return <section className="boardSection dogSection">
    <div className="dogIntro"><div><span className="sectionEyebrow">NBA · DOG + TOTAL</span><h2>Two legs. One researched matchup.</h2><p>The model chooses an underdog alternate spread and an Over or Under alternate total, then estimates both hitting together. It can pass on any matchup.</p></div><span className="pill emphasis">RESEARCH BETA</span></div>
    <div className="dogNotice">Model targets require sportsbook confirmation. Probabilities are uncalibrated estimates; no betting edge has been established. A candidate becomes a price comparison only after you supply the actual combined SGP odds.</div>
    {!board&&!error&&<div className="stateBox" role="status">Researching NBA spreads, scoring form, rest and injury reports…</div>}
    {error&&<div className="stateBox errorBox" role="alert">{error} <button type="button" className="dogSelect" onClick={()=>setRetry(x=>x+1)}>Retry research</button></div>}
    {board&&<>
      <section className="statusStrip"><div><span>Research candidates</span><strong>{board.candidates||0}</strong></div><div><span>Matchups checked</span><strong>{board.games?.length||0}</strong></div><div><span>Market snapshot</span><strong>{fmt(board.fetchedAt)}</strong></div><div><span>Research checked</span><strong>{fmt(board.researchAt)}</strong></div></section>
      {board.message&&<div className="stateBox">{board.message}</div>}
      {board.status==="ACTIVE"&&!board.candidates&&<div className="stateBox">No combinations meet the model’s requirements on this slate. See each matchup’s pass reason below.</div>}
      <div className="gameGrid">{(board.games||[]).map(g=><DogCard key={g.id} g={g} selected={selected.some(x=>x.id===g.id)} onToggle={toggle}/>)}</div>
      {selected.length>0&&<section className="dogBuilder"><div className="boardHeading"><div><span className="sectionEyebrow">YOUR RESEARCH BUILDER</span><h2>{selected.length} game combos · {selected.length*2} legs</h2></div><button type="button" className="dogSelect" onClick={()=>setSelected([])}>Clear</button></div>{selected.map(g=><div className="dogBuilderRow" key={g.id}><div><strong>{g.dog} +{one(g.altSpread)}</strong><span>{g.direction} {one(g.altTotal)} · {fmt(g.kickoff)}</span></div><button type="button" className="dogSelect" onClick={()=>toggle(g)} aria-label={`Remove ${g.away} at ${g.home}`}>Remove</button></div>)}<p>Combined parlay odds and win probability are unavailable. Each additional game adds another way for the ticket to lose.</p><button type="button" className="dogSelect" onClick={copy}>{copied?"Copied":"Copy targets"}</button></section>}
      {board.methodology&&<details className="why dogMethod"><summary>How the model chooses its pairs</summary><div className="whyBody"><p>{board.methodology}</p><p>The model tests spread cushions of 6–15 points and total cushions of 8–15 points, selecting the smallest combined cushion with an estimated joint hit rate of at least 68% and individual hit rates of at least 78%. It passes on stale markets, inadequate samples, unclear total direction, missing injury research, or an unresolved leading-scorer injury. These thresholds are research settings, not proven performance.</p><p>Joint simulation preserves an estimated margin/total relationship. Historical outcomes are not multiplied as independent leg probabilities. Injuries are a screening check; their scoring impact is not invented. No confirmed-lineup, possession-pace or travel-distance feed is included.</p><p>Odds API markets share the existing six-hour NBA cache. ESPN research refreshes every 15 minutes. Version {board.modelVersion}.</p></div></details>}
    </>}
  </section>;
}
