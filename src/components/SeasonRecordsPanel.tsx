'use client';

import Link from 'next/link';
import { Activity, Bike, Crown, Footprints, Medal, Trophy, Users, Waves } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { SeasonRecord } from '@/lib/season-records';

const icons:Record<string,React.ComponentType<{className?:string}>>={
  'weekly-points':Trophy,'longest-run':Footprints,'longest-ride':Bike,'longest-swim':Waves,'longest-hike':Activity,'fastest-run':Crown,'most-activities':Medal,'most-buddies':Users,'biggest-climb':Crown,
};

export default function SeasonRecordsPanel({compact=false}:{compact?:boolean}){
  const [records,setRecords]=useState<SeasonRecord[]>([]);
  const [seasonName,setSeasonName]=useState('Current season');
  const [loading,setLoading]=useState(true);
  useEffect(()=>{let cancelled=false;fetch('/api/season/records',{cache:'no-store'}).then(async response=>{const data=await response.json();if(!cancelled&&response.ok){setRecords(data.records??[]);setSeasonName(data.season?.challengeName??'Current season');}}).catch(()=>{}).finally(()=>{if(!cancelled)setLoading(false);});return()=>{cancelled=true;};},[]);

  if(compact){
    const featured=records.slice(0,4);
    return <section className="rounded-2xl border border-yellow-300/15 bg-yellow-300/[0.04] p-5 sm:p-6"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-yellow-300">Season records</p><h2 className="mt-1 text-xl font-black">{seasonName}</h2></div><Trophy className="h-5 w-5 text-yellow-300"/></div><div className="mt-4 grid grid-cols-2 gap-3">{loading?Array.from({length:4},(_,i)=><div key={i} className="h-24 animate-pulse rounded-xl bg-white/5"/>):featured.map(record=><RecordCard key={record.key} record={record} compact/>)}</div><Link href="/trophies#season-records" className="mt-4 inline-flex text-xs font-black text-yellow-200 hover:underline">View all season records →</Link></section>;
  }

  return <details className="dashboard-fold" id="season-records"><summary>Season records</summary><section className="rounded-2xl border border-yellow-300/15 bg-[radial-gradient(circle_at_top_right,_rgba(253,224,71,0.12),_transparent_34%),rgba(255,255,255,0.035)] p-5 sm:p-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-yellow-300">Records board</p><h2 className="mt-1 text-2xl font-black">{seasonName}</h2><p className="mt-1 text-sm text-slate-500">Challenge-wide records update from approved activities and saved standings.</p></div><Trophy className="h-7 w-7 text-yellow-300"/></div><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{loading?Array.from({length:9},(_,i)=><div key={i} className="h-32 animate-pulse rounded-2xl bg-white/5"/>):records.map(record=><RecordCard key={record.key} record={record}/>)}</div></section></details>;
}

function RecordCard({record,compact=false}:{record:SeasonRecord;compact?:boolean}){
  const Icon=icons[record.key]??Trophy;
  const body=<><div className="flex items-start justify-between gap-2"><span className="rounded-lg bg-yellow-300/10 p-2 text-yellow-300"><Icon className="h-4 w-4"/></span><span className="text-right text-xs font-black text-yellow-200">{record.displayValue}</span></div><p className={`${compact?'mt-2 text-xs':'mt-4 text-sm'} font-black text-slate-100`}>{record.label}</p><p className="mt-1 truncate text-xs font-bold text-slate-400">{record.holderName}</p>{compact?null:<p className="mt-1 text-[0.68rem] text-slate-600">{record.detail}</p>}</>;
  return record.holderId?<Link href={`/participants/${record.holderId}`} className="rounded-2xl border border-white/8 bg-black/15 p-4 transition hover:border-yellow-300/25">{body}</Link>:<div className="rounded-2xl border border-white/8 bg-black/15 p-4">{body}</div>;
}
