"use client";
import{useEffect,useState}from"react";
const one=x=>Number.isFinite(x)?x.toFixed(1):"—";
const signed=x=>Number.isFinite(x)?`${x>0?"+":""}${x}`:"—";
const fmt=x=>x?new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}).format(new Date(x))+" ET":"Pending";
export default function NbaSpreads(){
  const[board,setBoard]=useState(null),[error,setError]=useState(""),[retry,setRetry]=useState(0);
  useEffect(()=>{const c=new AbortController();setBoard(null);setError("");fetch("/api/nba/spreads",{cache:"no-store",signal:c.signal}).then(async r=>{const b=await r.json();if(!r.ok)throw new Error(b.message||"Spread research unavailable.");return b;}).then(setBoard).catch(e=>{if(e.name!=="AbortError")setError(e.message);});return()=>c.abort();},[retry]);
  return <section className="boardSection dogSection">
    <div className="dogIntro"><div><span className="sectionEyebrow">NBA · BEST SPREADS</span><h2>The strongest spread candidates.</h2><p>Up to five favorites or underdogs, ranked by estimated return at the quoted spread price. The model researches scoring, home/away form, rest and injuries, and can pass on the entire slate.</p></div><span className="pill emphasis">RESEARCH BETA</span></div>
    <div className="dogNotice">These are standard market spreads. Prices are cached sportsbook snapshots, not live bet slips. Model probabilities and returns are unvalidated estimates; confirm the line and price before using a pick.</div>
    {!board&&!error&&<div className="stateBox" role="status">Researching NBA spreads and matchup context…</div>}
    {error&&<div className="stateBox errorBox" role="alert">{error} <button type="button" className="dogSelect" onClick={()=>setRetry(x=>x+1)}>Retry</button></div>}
    {board&&<>
      <section className="statusStrip"><div><span>Candidates shown</span><strong>{board.games.length}</strong></div><div><span>Games researched</span><strong>{board.slateGames||0}</strong></div><div><span>Odds snapshot</span><strong>{fmt(board.fetchedAt)}</strong></div><div><span>Research checked</span><strong>{fmt(board.researchAt)}</strong></div></section>
      {board.message&&<div className="stateBox">{board.message}</div>}
      {board.status==="ACTIVE"&&!board.games.length&&<div className="stateBox">No spreads meet the research requirements on this slate. Pass reasons are listed below.</div>}
      <div className="gameGrid">{board.games.map(g=><article className="gameCard isHot" key={g.id}><div className="cardHead"><div className="cardHeadMain"><div className="kickoff">{fmt(g.kickoff)}</div><h3>{g.away} <span>@</span> {g.home}</h3><span className="pill emphasis">SPREAD #{g.rank}</span></div></div>
        <div className="dogLegs"><div><span>MODEL SPREAD CANDIDATE</span><strong>{g.team} {signed(g.line)}</strong><small>{signed(g.price)} · {g.book} · Quote {fmt(g.quotedAt)}</small></div></div>
        <div className="numbersRow"><div><span>Model edge</span><strong>+{one(g.edge)} pts</strong></div><div><span>Cover · estimate</span><strong>{one(g.coverProbability)}%</strong></div><div><span>Return · estimate</span><strong>{signed(g.expectedReturn)}%</strong></div><div><span>Sample · away/home</span><strong>{g.awayGames}/{g.homeGames}</strong></div></div>
        <details className="why"><summary>Research & risks</summary><div className="whyBody">{g.reasons.map((r,i)=><p key={i}>{r}</p>)}<p>Estimated push probability {one(g.pushProbability)}%. Fair decimal price {g.fairDecimal.toFixed(2)}. Rest: {g.away} {one(g.rest.away)} days; {g.home} {one(g.rest.home)} days.</p><p><strong>Injury feed checked:</strong> {g.injuries.length?`${g.injuries.length} reported injuries`:"No injuries listed for these teams"}.</p>{g.injuries.map((x,i)=><p key={i}><strong>{x.player} · {x.team} · {x.status}</strong>{x.note?` — ${x.note}`:""}</p>)}{g.warnings.map((w,i)=><p className="dogRisk" key={i}>{w}</p>)}{g.sourceUrl&&<a href={g.sourceUrl} target="_blank" rel="noreferrer">ESPN matchup research ↗</a>}</div></details>
      </article>)}</div>
      {board.passes.length>0&&<details className="why dogMethod"><summary>Passed matchups ({board.passes.length})</summary><div className="whyBody">{board.passes.map(g=><div key={g.id}><h3>{g.away} @ {g.home}</h3><p>{g.reasons.join(" ")}</p></div>)}</div></details>}
      <details className="why dogMethod"><summary>How Best Spreads works</summary><div className="whyBody"><p>The model starts with the consensus spread, blends in recent regular-season scoring, home/away splits and rest, and caps disagreement with the market. Both teams need at least four recent regular-season games. Preseason games are excluded.</p><p>A candidate needs a 1.5-point modeled edge, at least two books, a fresh quote at the exact selected line, and at least 2% estimated return at that price. Pushes are accounted for on integer spreads. Missing injury research or an unresolved leading-scorer designation causes a pass. Injury point impacts, confirmed lineups, possession pace and travel distance are not modeled.</p><p>The five highest estimated returns are shown. Results are not historically calibrated or backtested, and this ranking does not demonstrate a profitable strategy. Spreads share the existing six-hour NBA odds cache; ESPN injury research refreshes every 15 minutes.</p></div></details>
    </>}
  </section>;
}
