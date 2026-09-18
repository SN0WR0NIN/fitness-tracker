'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Crown, Medal, Trophy } from 'lucide-react';

type SeasonSummary={
  seasonKey:string;
  challengeName:string;
  startDate:string;
  endDate:string;
  status:'PLANNED'|'ACTIVE'|'ARCHIVED';
  rank:number|null;
  participantCount:number;
  points:number;
  activities:number;
  distanceKm:number;
  buddySessions:number;
  bestWeek:{weekNumber:number;points:number}|null;
};

export default function SeasonHistoryPanel({embedded=false}:{embedded?:boolean}={}) {
  const [seasons,setSeasons]=useState<SeasonSummary[]>([]);
  const [selected,setSelected]=useState('');
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    let cancelled=false;
    fetch('/api/profile/seasons',{cache:'no-store'})
      .then(async response=>{
        const data=await response.json();
        if(!cancelled&&response.ok){
          const rows=(data.seasons??[]) as SeasonSummary[];
          setSeasons(rows);
          setSelected(rows.find(row=>row.status==='ACTIVE')?.seasonKey??rows[0]?.seasonKey??'');
        }
      })
      .catch(()=>{})
      .finally(()=>{if(!cancelled)setLoading(false);});
    return()=>{cancelled=true;};
  },[]);

  const season=useMemo(()=>seasons.find(row=>row.seasonKey===selected)??seasons[0]??null,[seasons,selected]);

  const content=<section className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 sm:p-6">
    {loading?<div className="h-36 animate-pulse rounded-xl bg-white/5"/>:season?<>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-sky-300">Season archive</p>
          <h2 className="mt-1 text-xl font-black">Your challenge history</h2>
          <p className="mt-1 text-xs text-slate-500">Archived seasons are read-only. Switching here never changes the live scoring season.</p>
        </div>
        <select aria-label="Season to view" value={season.seasonKey} onChange={event=>setSelected(event.target.value)} className="min-h-11 rounded-xl border border-white/10 bg-slate-950 px-4 text-sm font-bold text-white">
          {seasons.map(row=><option key={row.seasonKey} value={row.seasonKey}>{new Date(row.startDate).getUTCFullYear()} · {row.challengeName}{row.status==='ACTIVE'?' (Current)':''}</option>)}
        </select>
      </div>
      <div className="mt-5 rounded-2xl border border-white/5 bg-black/10 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-sky-300"/><h3 className="text-lg font-black">{season.challengeName}</h3></div>
            <p className="mt-1 text-xs text-slate-500">{date(season.startDate)} – {date(season.endDate)} · {season.status}</p>
          </div>
          <div className="text-right"><p className="text-3xl font-black text-lime-300">{season.points.toFixed(1)}</p><p className="text-[0.65rem] uppercase tracking-wide text-slate-500">points</p></div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Stat icon={<Crown/>} label="Final/current rank" value={season.rank?`#${season.rank} / ${season.participantCount}`:'—'}/>
          <Stat icon={<Trophy/>} label="Activities" value={season.activities.toString()}/>
          <Stat icon={<CalendarDays/>} label="Distance" value={`${season.distanceKm.toFixed(1)} km`}/>
          <Stat icon={<Medal/>} label="Buddy sessions" value={season.buddySessions.toString()}/>
          <Stat icon={<Trophy/>} label="Best week" value={season.bestWeek?`W${season.bestWeek.weekNumber} · ${season.bestWeek.points.toFixed(1)}`:'—'}/>
        </div>
      </div>
    </>:<p className="text-sm text-slate-500">No season history is available yet.</p>}
  </section>;

  return embedded?content:<details className="dashboard-fold"><summary>Season history</summary>{content}</details>;
}

function Stat({icon,label,value}:{icon:React.ReactNode;label:string;value:string}) {
  return <div className="rounded-xl border border-white/5 bg-white/[0.025] p-3"><span className="text-slate-500 [&>svg]:h-4 [&>svg]:w-4">{icon}</span><p className="mt-2 text-[0.62rem] uppercase tracking-wide text-slate-600">{label}</p><p className="mt-1 text-sm font-black text-slate-200">{value}</p></div>;
}
function date(value:string){return new Date(value).toLocaleDateString('en-SG',{timeZone:'Asia/Singapore',day:'numeric',month:'short',year:'numeric'});}
