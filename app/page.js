"use client";

import{useEffect,useMemo,useState}from"react";

const SPORTS=[
  ["NFL","NFL"],
  ["NCAA","NCAA Totals"],
  ["NBA","NBA Totals"],
  ["WNBA","WNBA Totals"],
  ["MLB","Baseball Totals"]
];

const NFL_FILTERS=[
  ["ALL","All Games"],
  ["OVER","Overs"],
  ["UNDER","Unders"],
  ["HOT","🔥 Hot Picks"]
];

function fmt(v){
  if(!v)return"Pending";
  return new Intl.DateTimeFormat("en-US",{
    weekday:"short",month:"short",day:"numeric",hour:"numeric",minute:"2-digit",
    timeZone:"America/New_York"
  }).format(new Date(v))+" ET";
}

function fmtUpdated(v){
  if(!v)return"Pending";
  return new Intl.DateTimeFormat("en-US",{
    month:"short",day:"numeric",hour:"numeric",minute:"2-digit",
    timeZone:"America/New_York"
  }).format(new Date(v))+" ET";
}

const one=v=>Number.isFinite(v)?v.toFixed(1):"—";

function ScoreBar({score=0}){
  const safe=Math.max(0,Math.min(100,Number(score)||0));
  return <div className="scoreWrap">
    <div className="scoreLabel"><span>Hot Score</span><strong>{safe}</strong></div>
    <div className="scoreTrack"><span style={{width:`${safe}%`}}/></div>
  </div>
}

function NflCard({g}){
  return <article className={`gameCard ${g.isHot?"isHot":""}`}>
    <div className="cardHead">
      <div className="cardHeadMain">
        <div className="kickoff">{fmt(g.kickoff)}</div>
        <h3>{g.away} <span>@</span> {g.home}</h3>
        <div className="cardBadges">
          {g.isHot&&<span className="pill emphasis">HOT PICK #{g.hotRank}</span>}
          <span className="pill">{g.weather?.label||"Weather pending"}</span>
        </div>
      </div>
      <div className={`sideStamp ${g.side?.toLowerCase()}`}>{g.side}</div>
    </div>

    <div className="pickHero">
      <div><span className="pickEyebrow">ALT25 PLAY</span><div className={`mainPick ${g.side?.toLowerCase()}`}>{g.side} {one(g.altLine)}</div></div>
      <div className="confidenceBox"><span>Confidence</span><strong>{g.confidence}</strong></div>
    </div>

    <div className="numbersRow">
      <div><span>Market</span><strong>{one(g.total)}</strong></div>
      <div><span>Model</span><strong>{one(g.projected)}</strong></div>
      <div><span>Edge</span><strong>{g.edge>0?"+":""}{one(g.edge)}</strong></div>
      <div><span>Books</span><strong>{g.booksCount??"—"}</strong></div>
    </div>

    <ScoreBar score={g.hotScore}/>

    <details className="why">
      <summary>Why this pick?</summary>
      <div className="whyBody"><p className="modelReason">{g.modelNote}</p></div>
    </details>
  </article>
}

function SportCard({g,sport}){
  return <article className="gameCard isHot">
    <div className="cardHead">
      <div className="cardHeadMain">
        <div className="kickoff">{fmt(g.kickoff)}</div>
        <h3>{g.away} <span>@</span> {g.home}</h3>
        <div className="cardBadges">
          <span className="pill emphasis">#{g.rank} {sport} PICK</span>
        </div>
      </div>
      <div className={`sideStamp ${g.side?.toLowerCase()}`}>{g.side}</div>
    </div>

    <div className="pickHero">
      <div><span className="pickEyebrow">ALT25 PLAY</span><div className={`mainPick ${g.side?.toLowerCase()}`}>{g.side} {one(g.altLine)}</div></div>
      <div className="confidenceBox"><span>Confidence</span><strong>{g.confidence}</strong></div>
    </div>

    <div className="numbersRow">
      <div><span>Market</span><strong>{one(g.total)}</strong></div>
      <div><span>Model</span><strong>{one(g.projected)}</strong></div>
      <div><span>Edge</span><strong>{g.edge>0?"+":""}{one(g.edge)}</strong></div>
      <div><span>Books</span><strong>{g.booksCount??"—"}</strong></div>
    </div>

    <ScoreBar score={g.hotScore}/>

    <details className="why">
      <summary>Why this pick?</summary>
      <div className="whyBody">
        <p className="modelReason">{g.modelNote}</p>
        {g.seasonContextEffect?.label&&<div className="contextAlert"><strong>Late-season context:</strong> {g.seasonContextEffect.label}</div>}
        <div className="teamStats">
          <div className="teamStatBox"><strong>{g.away}</strong><span>Recent PF {one(g.awayProfile?.pointsFor)}</span><span>Recent PA {one(g.awayProfile?.pointsAllowed)}</span><span>Games {g.awayProfile?.games??0}</span></div>
          <div className="teamStatBox"><strong>{g.home}</strong><span>Recent PF {one(g.homeProfile?.pointsFor)}</span><span>Recent PA {one(g.homeProfile?.pointsAllowed)}</span><span>Games {g.homeProfile?.games??0}</span></div>
        </div>
      </div>
    </details>
  </article>
}

export default function Home(){
  const[nfl,setNfl]=useState(null);
  const[error,setError]=useState("");
  const[sport,setSport]=useState("NFL");
  const[nflFilter,setNflFilter]=useState("ALL");
  const[sportBoards,setSportBoards]=useState({});
  const[loadingSport,setLoadingSport]=useState("");
  const[wrBoard,setWrBoard]=useState(null);
  const[wrError,setWrError]=useState("");

  useEffect(()=>{
    fetch("/api/board",{cache:"no-store"})
      .then(r=>{if(!r.ok)throw new Error("Could not load NFL board.");return r.json()})
      .then(setNfl)
      .catch(e=>setError(e.message));
  },[]);

  useEffect(()=>{
    fetch("/api/nfl/wr-matchups",{cache:"no-store"})
      .then(async r=>{const b=await r.json().catch(()=>({}));if(!r.ok)throw new Error(b?.error||"Could not load WR matchups.");return b})
      .then(setWrBoard).catch(e=>setWrError(e.message));
  },[]);

  useEffect(()=>{
    if(sport==="NFL"||sportBoards[sport])return;
    setLoadingSport(sport);
    fetch(`/api/sport/${sport}`,{cache:"no-store"})
      .then(async r=>{
        const body=await r.json().catch(()=>({}));
        if(!r.ok)throw new Error(body?.error||`Could not load ${sport}.`);
        return body;
      })
      .then(d=>setSportBoards(prev=>({...prev,[sport]:d})))
      .catch(e=>setSportBoards(prev=>({...prev,[sport]:{status:"ERROR",message:e.message,games:[]}})))
      .finally(()=>setLoadingSport(""));
  },[sport,sportBoards]);

  const nflGames=useMemo(()=>{
    const list=nfl?.games||[];
    if(nflFilter==="ALL")return list;
    if(nflFilter==="HOT")return list.filter(g=>g.isHot).sort((a,b)=>(a.hotRank||99)-(b.hotRank||99));
    return list.filter(g=>g.side===nflFilter);
  },[nfl,nflFilter]);

  const featured=useMemo(()=>(
    (nfl?.games||[]).filter(g=>g.isHot).sort((a,b)=>(a.hotRank||99)-(b.hotRank||99)).slice(0,3)
  ),[nfl]);

  const activeBoard=sport==="NFL"?nfl:sportBoards[sport];

  return <main className="siteShell">
    <header className="topBar">
      <a className="brand" href="#" onClick={e=>{e.preventDefault();setSport("NFL")}}>
        <span className="brandMark">25</span>
        <span><strong>ALT25</strong><small>SPORTS TOTALS INTELLIGENCE</small></span>
      </a>
      <div className="liveChip"><span className="liveDot"/>{sport==="NFL"?(nfl?.boardMode==="WAITING"?"NEXT SLATE":"NFL BOARD"):`${sport} TOP 3`}</div>
    </header>

    <section className="heroRevamp">
      <div>
        <div className="kicker">TOTALS ACROSS THE BOARD</div>
        <h1>Find the edge.<br/><span>Take the 2.5.</span></h1>
        <p>ALT25 analyzes totals across football, basketball and baseball. NFL gets the full board; other sports surface only the three strongest model-rated totals from the next slate using recent form, defense, location, rest and sport-specific context.</p>
      </div>
      <div className="heroPanel">
        <span>Selected Sport</span>
        <strong>{sport}</strong>
        <div>{sport==="NFL"?(nfl?.oddsMode||"Loading NFL"):(activeBoard?.status==="ACTIVE"?"Top 3 totals":activeBoard?.status||"Loading")}</div>
      </div>
    </section>

    <nav className="sportTabs" aria-label="Sports">
      {SPORTS.map(([id,label])=><button key={id} type="button" className={sport===id?"active":""} onClick={()=>setSport(id)}>{label}</button>)}
    </nav>

    {sport==="NFL"&&<>
      {nfl&&<section className="statusStrip">
        <div><span>Games</span><strong>{nfl.games?.length||0}</strong></div>
        <div><span>Odds refresh</span><strong>{nfl.oddsCacheHours||2}h</strong></div>
        <div><span>Last odds pull</span><strong>{fmtUpdated(nfl.oddsFetchedAt)}</strong></div>
        <div><span>Week</span><strong>{nfl.week||"—"}</strong></div>
      </section>}

      {nfl&&nfl.boardMode==="EARLY"&&<section className="lullBanner">
        <div><span className="sectionEyebrow">EARLY BOARD</span><h2>Next NFL slate is live.</h2><p>Totals are posted. Weather and injury information will sharpen automatically as kickoff gets closer.</p></div>
        <div className="readiness"><span className="ready">Odds ✓</span><span>Weather developing</span><span>Injuries developing</span><span>Model active</span></div>
      </section>}

      {nfl&&nfl.boardMode==="WAITING"&&<section className="lullBanner">
        <div><span className="sectionEyebrow">NEXT NFL SLATE</span><h2>Lines are loading.</h2><p>The matchups are here. ALT25 will turn them into picks automatically when totals post.</p></div>
        <div className="readiness"><span>Odds pending</span><span>Schedule ✓</span><span>Model standing by</span></div>
      </section>}

      {nfl&&nfl.boardMode==="WAITING"&&nfl.upcomingSchedule?.length>0&&<section className="schedulePreview">
        <div className="sectionTitle"><div><span className="sectionEyebrow">UPCOMING</span><h2>NFL Week {nfl.week}</h2></div></div>
        <div className="previewGrid">{nfl.upcomingSchedule.map((g,i)=><div className="previewCard" key={i}><span>{fmt(g.kickoff)}</span><strong>{g.away} @ {g.home}</strong><small>Waiting for total</small></div>)}</div>
      </section>}

      {nfl&&nfl.boardMode!=="WAITING"&&featured.length>0&&<section className="featuredSection">
        <div className="sectionTitle">
          <div><span className="sectionEyebrow">NFL THIS WEEK</span><h2>🔥 Featured Hot Picks</h2></div>
          <button type="button" onClick={()=>setNflFilter("HOT")}>View top 5 →</button>
        </div>
        <div className="featuredGrid">{featured.map((g,i)=><button type="button" className="featuredPick" key={i} onClick={()=>setNflFilter("HOT")}>
          <span className="featuredRank">#{i+1}</span><span className="featuredTeams">{g.away} @ {g.home}</span><strong className={g.side?.toLowerCase()}>{g.side} {one(g.altLine)}</strong><span>Hot Score {g.hotScore}/100</span>
        </button>)}</div>
      </section>}

      {nfl&&nfl.boardMode!=="WAITING"&&<section className="wrSection">
        <div className="sectionTitle">
          <div>
            <span className="sectionEyebrow">NFL RECEIVING MATCHUPS</span>
            <h2>🎯 Top 10 WR ALT Matchups</h2>
            <p className="wrIntro">Wide receivers facing a bottom-10 defense in opponent passing yards per completion. Ranked using matchup weakness plus the receiver's season production.</p>
          </div>
          {wrBoard&&<span className="wrWeek">Week {wrBoard.week}</span>}
        </div>
        {!wrBoard&&!wrError&&<div className="stateBox">Building WR matchup board…</div>}
        {wrError&&<div className="stateBox errorBox">{wrError}</div>}
        {wrBoard&&wrBoard.players?.length===0&&<div className="stateBox">No qualifying WR matchups found yet for this week's upcoming games.</div>}
        {wrBoard&&wrBoard.players?.length>0&&<>
          <div className="wrGrid">{wrBoard.players.map(w=><article className="wrCard" key={`${w.rank}-${w.athleteId}`}>
            <div className="wrRank">#{w.rank}</div>
            <div className="wrMain"><strong>{w.player}</strong><span>{w.team} vs {w.opponent}</span></div>
            <div className="wrMetric"><span>DEF YDS/COMP</span><strong>{w.oppYardsPerCompletion}</strong><small>Defense rank #{w.defenseRank}</small></div>
            <div className="wrMetric"><span>REC YDS/G</span><strong>{w.yardsPerGame??"—"}</strong><small>{w.yardsPerReception??"—"} YPR</small></div>
            <div className="wrMetric score"><span>MATCHUP</span><strong>{w.matchupScore}</strong><small>ranking score</small></div>
          </article>)}</div>
          <div className="wrNote">Bottom 10 = the 10 defenses allowing the highest opponent passing yards per completion. Matchup Score is a ranking score, not a probability. No player-prop Odds API market is used.</div>
        </>}
      </section>}

      {nfl&&nfl.boardMode!=="WAITING"&&<nav className="tabBar" aria-label="NFL filters">
        {NFL_FILTERS.map(([id,label])=><button key={id} type="button" className={nflFilter===id?"active":""} onClick={()=>setNflFilter(id)}>{label}</button>)}
      </nav>}

      {error&&<div className="stateBox errorBox">{error}</div>}
      {!nfl&&!error&&<div className="stateBox">Building the NFL board…</div>}

      {nfl&&nfl.boardMode!=="WAITING"&&<section className="boardSection">
        <div className="boardHeading"><div><span className="sectionEyebrow">NFL</span><h2>{nflFilter==="ALL"?"Full Board":nflFilter==="HOT"?"Top 5 Hot Picks":`${nflFilter} Picks`}</h2></div><span>{nflGames.length} games</span></div>
        <div className="gameGrid">{nflGames.map((g,i)=><NflCard g={g} key={`${g.away}-${g.home}-${i}`}/>)}</div>
      </section>}
    </>}

    {sport!=="NFL"&&<section className="otherSportSection">
      {loadingSport===sport&&!sportBoards[sport]&&<div className="stateBox">Loading {sport} totals…</div>}

      {sportBoards[sport]&&sportBoards[sport].status==="OFFSEASON"&&<div className="seasonState">
        <span className="sectionEyebrow">{sport}</span><h2>Season not active.</h2><p>{sportBoards[sport].message} This tab will activate automatically when the league returns.</p>
      </div>}

      {sportBoards[sport]&&sportBoards[sport].status==="WAITING"&&<div className="seasonState">
        <span className="sectionEyebrow">{sport}</span><h2>Waiting for totals.</h2><p>{sportBoards[sport].message}</p>
      </div>}

      {sportBoards[sport]&&sportBoards[sport].status==="ERROR"&&<div className="stateBox errorBox">{sportBoards[sport].message}</div>}

      {sportBoards[sport]&&sportBoards[sport].status==="ACTIVE"&&<>
        <section className="sportStatus">
          <div><span className="sectionEyebrow">{sport}</span><h2>Top {sportBoards[sport].games.length} Totals</h2><p>ALT25 analyzed {sportBoards[sport].slateGames} games in the next slate and surfaced only the strongest three model-rated totals. Model: {sportBoards[sport].modelVersion||"smart-v2"}.</p></div>
          <div className="sportMeta"><span>Odds cache <strong>{sportBoards[sport].cacheHours}h</strong></span><span>Updated <strong>{fmtUpdated(sportBoards[sport].fetchedAt)}</strong></span></div>
        </section>
        <div className="gameGrid">{sportBoards[sport].games.map((g,i)=><SportCard g={g} sport={sport} key={`${g.away}-${g.home}-${i}`}/>)}</div>
      </>}
    </section>}

    <footer className="footerRevamp">
      <div><strong>ALT25</strong><span>Sports Totals Intelligence</span></div>
      <p>Hot Score is a ranking score, not a win probability. NFL uses the full ALT25 model. All sports now include late-season context when standings or record data support it. NCAA uses a conservative record-based version; MLB also uses probable-starting-pitcher ERA when available. Missing data is skipped rather than invented.</p>
    </footer>
  </main>;
}
