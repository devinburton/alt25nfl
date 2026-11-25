"use client";

import { useEffect, useState } from "react";

const points = value => Number.isFinite(value) ? value.toFixed(1) : "—";

function TeamLine({team}){
  const target = team.side && `${team.side === "OVER" ? "Over" : "Under"} ${points(team.target)}`;
  return <div className="teamTotalTeam">
    <h4>{team.name}</h4>
    <dl>
      <div><dt>Projected points</dt><dd>{points(team.projected)}</dd></div>
      <div><dt>Implied team total</dt><dd>{points(team.implied)}</dd></div>
    </dl>
    <div className="teamTotalTarget">
      {target
        ? <><strong className={team.side.toLowerCase()}>{target}</strong> <span>{team.side === "OVER" ? "or lower" : "or higher"}</span></>
        : <span>{team.projected === null ? "Waiting for recent team results" : "Pass · Small model gap"}</span>}
    </div>
  </div>;
}

export default function TeamTotals({sport, board, error, formatGameTime, formatSnapshot}){
  const [now, setNow] = useState(Date.now);
  useEffect(()=>{
    const timer = setInterval(()=>setNow(Date.now()), 60_000);
    return ()=>clearInterval(timer);
  },[]);

  const games = (board?.games || [])
    .filter(game=>Date.parse(game.kickoff)>now)
    .sort((a,b)=>Date.parse(a.kickoff)-Date.parse(b.kickoff));
  const best = games
    .flatMap(game=>game.teamTotals || [])
    .filter(team=>team.side)
    .sort((a,b)=>Math.abs(b.gap)-Math.abs(a.gap))[0];
  const totalSnapshot = sport === "NFL" ? board?.oddsFetchedAt : board?.fetchedAt;
  const spreadSnapshot = sport === "NFL" ? board?.spreadFetchedAt : null;

  return <section className="boardSection">
    <div className="sportStatus">
      <div>
        <h2>{sport} Team Totals</h2>
        <p>See how many points each team is projected to score. Targets are model estimates using game totals and spreads. Compare them with your sportsbook’s team line and price.</p>
      </div>
      {totalSnapshot&&<div className="sportMeta">
        <span>{spreadSnapshot ? "Totals snapshot" : "Odds snapshot"} <strong>{formatSnapshot(totalSnapshot)}</strong></span>
        {spreadSnapshot&&<span>Spread snapshot <strong>{formatSnapshot(spreadSnapshot)}</strong></span>}
      </div>}
    </div>
    {error&&<div className="stateBox errorBox" role="alert">{error}</div>}
    {!board&&!error&&<div className="stateBox" role="status">Loading team totals…</div>}
    {board&&!error&&!games.length&&<div className="stateBox">
      {board.message || "No upcoming games with odds are on this slate yet."}
    </div>}
    {best&&<div className="dogBuilder teamTotalsBest">
      <span className="sectionEyebrow">STRONGEST MODEL LEAN</span>
      <h3>{best.name} · {best.side === "OVER" ? "Over" : "Under"} {points(best.target)} {best.side === "OVER" ? "or lower" : "or higher"}</h3>
      <p>{points(Math.abs(best.gap))} points between the projection and the implied team total.</p>
    </div>}
    <div className="gameGrid">
      {games.map(game=><article className="gameCard" key={`${game.away}-${game.home}-${game.kickoff}`}>
        <div className="cardHead">
          <div className="cardHeadMain">
            <div className="kickoff">{formatGameTime(game.kickoff)}</div>
            <h3>{game.away} <span>@</span> {game.home}</h3>
          </div>
        </div>
        {game.teamTotals
          ? <div className="teamTotalTeams">{game.teamTotals.map(team=><TeamLine key={team.name} team={team}/>)}</div>
          : <p className="wrNote">Waiting for a matching game total and spread.</p>}
      </article>)}
    </div>
  </section>;
}
