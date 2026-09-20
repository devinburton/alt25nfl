"use client";

import { useEffect, useMemo, useState } from "react";

const TABS = [
  ["ALL","All Games"],
  ["OVER","Overs"],
  ["UNDER","Unders"],
  ["HOT","🔥 Hot Picks"],
  ["PARLAY","🎯 3-Leg"],
  ["LOTTERY","🎰 Sunday Lottery"]
];

function fmtKickoff(v){
  return new Intl.DateTimeFormat("en-US",{
    weekday:"short",month:"short",day:"numeric",hour:"numeric",minute:"2-digit",
    timeZone:"America/New_York"
  }).format(new Date(v))+" ET";
}

function fmtUpdated(v){
  if(!v) return "Pending";
  return new Intl.DateTimeFormat("en-US",{
    month:"short",day:"numeric",hour:"numeric",minute:"2-digit",
    timeZone:"America/New_York"
  }).format(new Date(v))+" ET";
}

const one=v=>Number.isFinite(v)?v.toFixed(1):"—";
const pct=v=>Number.isFinite(v)?`${Math.round(v*100)}%`:"—";

function ScoreBar({score=0}){
  const safe=Math.max(0,Math.min(100,Number(score)||0));
  return <div className="scoreWrap" aria-label={`Hot Score ${safe} out of 100`}>
    <div className="scoreLabel"><span>Hot Score</span><strong>{safe}</strong></div>
    <div className="scoreTrack"><span style={{width:`${safe}%`}} /></div>
  </div>
}

function GameCard({g,filter,index}){
  const rank = filter==="PARLAY" ? g.parlayRank : filter==="LOTTERY" ? g.lotteryRank : g.hotRank;
  const rankLabel = filter==="PARLAY" ? `PARLAY LEG ${rank}` :
                    filter==="LOTTERY" ? `LOTTERY LEG ${rank}` :
                    g.isHot ? `HOT PICK #${g.hotRank}` : null;

  return <article className={`gameCard ${g.isHot?"isHot":""}`}>
    <div className="cardHead">
      <div className="cardHeadMain">
        <div className="kickoff">{fmtKickoff(g.kickoff)}</div>
        <h3>{g.away} <span>@</span> {g.home}</h3>
        <div className="cardBadges">
          {rankLabel&&<span className="pill emphasis">{rankLabel}</span>}
          <span className="pill">{g.weather?.label||"Weather pending"}</span>
        </div>
      </div>
      <div className={`sideStamp ${g.side?.toLowerCase()}`}>{g.side}</div>
    </div>

    <div className="pickHero">
      <div>
        <span className="pickEyebrow">ALT 2.5 PLAY</span>
        <div className={`mainPick ${g.side?.toLowerCase()}`}>{g.side} {one(g.altLine)}</div>
      </div>
      <div className="confidenceBox">
        <span>Confidence</span>
        <strong>{g.confidence}</strong>
      </div>
    </div>

    <div className="numbersRow">
      <div><span>Market</span><strong>{one(g.total)}</strong></div>
      <div><span>Model</span><strong>{one(g.projected)}</strong></div>
      <div><span>Edge</span><strong>{g.edge>0?"+":""}{one(g.edge)}</strong></div>
      <div><span>Books</span><strong>{g.booksCount??"—"}</strong></div>
    </div>

    <ScoreBar score={g.hotScore} />

    <details className="why">
      <summary>Why this pick?</summary>
      <div className="whyBody">
        <p className="modelReason">{g.modelNote}</p>
        <div className="teamStats">
          <div className="teamStatBox">
            <strong>{g.away}</strong>
            <span>YPP {one(g.awayProfile?.ypp)}</span>
            <span>Plays {one(g.awayProfile?.plays)}</span>
            <span>RZ {pct(g.awayProfile?.redPct)}</span>
            <span>Expl {one(g.awayProfile?.explosive)}</span>
            <span>Injuries {g.awayInjury?.notable??0}</span>
          </div>
          <div className="teamStatBox">
            <strong>{g.home}</strong>
            <span>YPP {one(g.homeProfile?.ypp)}</span>
            <span>Plays {one(g.homeProfile?.plays)}</span>
            <span>RZ {pct(g.homeProfile?.redPct)}</span>
            <span>Expl {one(g.homeProfile?.explosive)}</span>
            <span>Injuries {g.homeInjury?.notable??0}</span>
          </div>
        </div>
      </div>
    </details>
  </article>
}

export default function Home(){
  const [data,setData]=useState(null);
  const [error,setError]=useState("");
  const [filter,setFilter]=useState("ALL");

  useEffect(()=>{
    fetch("/api/board",{cache:"no-store"})
      .then(r=>{if(!r.ok)throw new Error("Could not load the board.");return r.json()})
      .then(setData)
      .catch(e=>setError(e.message));
  },[]);

  const games=useMemo(()=>{
    const l=data?.games||[];
    if(filter==="ALL") return l;
    if(filter==="HOT") return l.filter(g=>g.isHot).sort((a,b)=>(a.hotRank||99)-(b.hotRank||99));
    if(filter==="PARLAY") return data?.parlay||[];
    if(filter==="LOTTERY") return data?.sundayLottery||[];
    return l.filter(g=>g.side===filter);
  },[data,filter]);

  const featured=useMemo(()=>{
    return (data?.games||[])
      .filter(g=>g.isHot)
      .sort((a,b)=>(a.hotRank||99)-(b.hotRank||99))
      .slice(0,3);
  },[data]);

  return <main className="siteShell">
    <header className="topBar">
      <a className="brand" href="#" aria-label="ALT25 home">
        <span className="brandMark">25</span>
        <span><strong>ALT25</strong><small>NFL TOTALS INTELLIGENCE</small></span>
      </a>
      <div className="liveChip"><span className="liveDot"/> {data?"LIVE BOARD":"CONNECTING"}</div>
    </header>

    <section className="heroRevamp">
      <div>
        <div className="kicker">BET THE TOTAL. MOVE THE LINE.</div>
        <h1>Find the edge.<br/><span>Take the 2.5.</span></h1>
        <p>ALT25 turns the live market total into a model-driven OVER or UNDER, then gives the pick a fixed 2.5-point cushion.</p>
      </div>
      {data&&<div className="heroPanel">
        <span>Current Board</span>
        <strong>Week {data.week}</strong>
        <div>NFL {data.year} · {data.oddsMode}</div>
      </div>}
    </section>

    {data&&<section className="statusStrip">
      <div><span>Games</span><strong>{data.games.length}</strong></div>
      <div><span>Odds refresh</span><strong>{data.oddsCacheHours||2}h</strong></div>
      <div><span>Last odds pull</span><strong>{fmtUpdated(data.oddsFetchedAt)}</strong></div>
      <div><span>Cushion</span><strong>2.5</strong></div>
    </section>}

    {data&&filter==="ALL"&&featured.length>0&&<section className="featuredSection">
      <div className="sectionTitle">
        <div><span className="sectionEyebrow">THIS WEEK</span><h2>🔥 Featured Hot Picks</h2></div>
        <button type="button" onClick={()=>setFilter("HOT")}>View top 5 →</button>
      </div>
      <div className="featuredGrid">
        {featured.map((g,i)=><button type="button" className="featuredPick" key={`${g.away}-${g.home}`} onClick={()=>setFilter("HOT")}>
          <span className="featuredRank">#{i+1}</span>
          <span className="featuredTeams">{g.away} @ {g.home}</span>
          <strong className={g.side?.toLowerCase()}>{g.side} {one(g.altLine)}</strong>
          <span>Hot Score {g.hotScore}/100</span>
        </button>)}
      </div>
    </section>}

    <nav className="tabBar" aria-label="ALT25 board filters">
      {TABS.map(([id,label])=><button
        key={id}
        type="button"
        className={filter===id?"active":""}
        onClick={()=>setFilter(id)}
      >{label}</button>)}
    </nav>

    {filter==="PARLAY"&&<div className="contextBanner">
      <strong>🎯 3-Leg Parlay</strong>
      <span>The three highest-rated model totals on the weekly board.</span>
    </div>}
    {filter==="LOTTERY"&&<div className="contextBanner warning">
      <strong>🎰 Sunday Lottery Ticket</strong>
      <span>Every Sunday total on one extreme-variance ticket.</span>
    </div>}

    {error&&<div className="stateBox errorBox">{error}</div>}
    {!data&&!error&&<div className="stateBox">Building the live ALT25 board…</div>}

    {data&&<section className="boardSection">
      <div className="boardHeading">
        <div>
          <span className="sectionEyebrow">{filter==="ALL"?"FULL SLATE":filter}</span>
          <h2>{filter==="ALL"?"This Week's Board":filter==="HOT"?"Top 5 Hot Picks":filter==="PARLAY"?"3-Leg Parlay":filter==="LOTTERY"?"Sunday Lottery Ticket":`${filter} Picks`}</h2>
        </div>
        <span>{games.length} {games.length===1?"game":"games"}</span>
      </div>
      <div className="gameGrid">
        {games.map((g,i)=><GameCard g={g} filter={filter} index={i} key={`${g.away}-${g.home}-${g.kickoff}-${filter}`} />)}
      </div>
    </section>}

    <footer className="footerRevamp">
      <div>
        <strong>ALT25</strong>
        <span>Hot Score is a ranking score, not a win probability.</span>
      </div>
      <p>Model inputs can include market edge, scoring, YPP, pace, red zone, third down, turnovers, weather, injuries and home/away form. Missing data is skipped rather than invented. Odds are cached to protect API usage.</p>
    </footer>
  </main>;
}
