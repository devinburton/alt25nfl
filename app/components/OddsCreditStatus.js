"use client";
import { useEffect,useState } from 'react';
export default function OddsCreditStatus(){
  const [status,setStatus]=useState(null);
  useEffect(()=>{const c=new AbortController();fetch('/api/odds-status',{signal:c.signal}).then(r=>r.ok?r.json():null).then(setStatus).catch(()=>{});return()=>c.abort();},[]);
  return <div className="dogNotice" role="status"><strong>Credit saver is on.</strong> NBA odds update at most every six hours; NFL totals every 12 hours. Other sports and NFL spreads use daily snapshots. Older quotes may cause research to pass. {status?.usagePercent!=null&&<span>Odds credits used: {status.usagePercent}% · Remaining: {status.remaining}. </span>}{status?.propsPaused&&<span>New player-prop odds are paused to protect the remaining balance; existing snapshots can still be used. </span>}{status?.mainPaused&&<span>New main-board odds requests are also paused at the reserve or while the balance cannot be verified. </span>}Always confirm current lines at your sportsbook.</div>;
}
