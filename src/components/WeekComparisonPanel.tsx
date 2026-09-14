'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';
import { formatPace } from '@/lib/format';
import { getWeekNumber } from '@/lib/scoring';
import type { MetricActivity } from '@/lib/personal-metrics';

type Metrics={points:number;distance:number;activities:number;pace:number|null;buddies:number};

function distanceKm(activity:MetricActivity){return activity.category==='SWIM'?activity.distance/1000:activity.category==='TROOP_GAMES'?0:activity.distance;}
function metricFor(rows:MetricActivity[]):Metrics{const runs=rows.filter(a=>a.category==='RUN'&&a.pace!==null&&a.pace>0);return{points:rows.reduce((s,a)=>s+a.points,0),distance:rows.reduce((s,a)=>s+distanceKm(a),0),activities:rows.length,pace:runs.length?runs.reduce((s,a)=>s+a.pace!,0)/runs.length:null,buddies:rows.filter(a=>a.completedWithFriend).length};}

export default function WeekComparisonPanel({activities}:{activities:MetricActivity[]}){
  const [startDate,setStartDate]=useState<Date|null>(null);
  useEffect(()=>{fetch('/api/config',{cache:'no-store'}).then(r=>r.json()).then(data=>{if(data.startDate)setStartDate(new Date(data.startDate));}).catch(()=>{});},[]);
  const approved=useMemo(()=>activities.filter(a=>a.status==='APPROVED'),[activities]);
  const weeks=useMemo(()=>{if(!startDate)return[];return [...new Set(approved.map(a=>getWeekNumber(new Date(a.occurredAt),startDate)).filter(n=>n>0))].sort((a,b)=>a-b);},[approved,startDate]);
  const defaultA=weeks.length>1?weeks[weeks.length-2]:weeks[0]??1,defaultB=weeks.at(-1)??1;
  const [weekA,setWeekA]=useState<number|null>(null),[weekB,setWeekB]=useState<number|null>(null);
  const a=weekA??defaultA,b=weekB??defaultB;
  const rowsA=startDate?approved.filter(row=>getWeekNumber(new Date(row.occurredAt),startDate)===a):[];
  const rowsB=startDate?approved.filter(row=>getWeekNumber(new Date(row.occurredAt),startDate)===b):[];
  const left=metricFor(rowsA),right=metricFor(rowsB);
  const cards=[
    {label:'Points',left:left.points,right:right.points,format:(v:number)=>`${v.toFixed(1)} pts`,lowerBetter:false},
    {label:'Distance',left:left.distance,right:right.distance,format:(v:number)=>`${v.toFixed(1)} km`,lowerBetter:false},
    {label:'Activities',left:left.activities,right:right.activities,format:(v:number)=>v.toFixed(0),lowerBetter:false},
    {label:'Average run pace',left:left.pace,right:right.pace,format:(v:number)=>`${formatPace(v)}/km`,lowerBetter:true},
    {label:'Buddy sessions',left:left.buddies,right:right.buddies,format:(v:number)=>v.toFixed(0),lowerBetter:false},
  ];
  if(!startDate)return <div className="h-36 animate-pulse rounded-2xl bg-white/[0.04]"/>;
  return <details className="dashboard-fold"><summary>Week comparison</summary><section className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 sm:p-6"><div className="flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-lg font-black">Compare your weeks</h2><p className="mt-1 text-xs text-slate-400">Approved activities only · compare training volume and performance.</p></div><div className="flex items-center gap-2"><WeekSelect value={a} weeks={weeks} onChange={setWeekA}/><ArrowRight className="h-4 w-4 text-slate-600"/><WeekSelect value={b} weeks={weeks} onChange={setWeekB}/></div></div>{weeks.length?<div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{cards.map(card=><CompareCard key={card.label} {...card}/>)}</div>:<p className="mt-5 text-sm text-slate-500">Complete an approved activity to start comparing weeks.</p>}</section></details>;
}

function WeekSelect({value,weeks,onChange}:{value:number;weeks:number[];onChange:(value:number)=>void}){return <select aria-label="Comparison week" value={value} onChange={e=>onChange(Number(e.target.value))} className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs font-bold">{weeks.map(week=><option key={week} value={week}>Week {week}</option>)}</select>;}
function CompareCard({label,left,right,format,lowerBetter}:{label:string;left:number|null;right:number|null;format:(value:number)=>string;lowerBetter:boolean}){const has=left!==null&&right!==null;const delta=has?right!-left!:0;const improved=has&&(lowerBetter?delta<0:delta>0),declined=has&&(lowerBetter?delta>0:delta<0);const Icon=improved?ArrowUpRight:declined?ArrowDownRight:ArrowRight;return <div className="rounded-xl border border-white/5 bg-black/10 p-4"><p className="text-[0.68rem] font-black uppercase tracking-wide text-slate-500">{label}</p><div className="mt-3 flex items-center justify-between gap-2"><span className="text-sm text-slate-500">{left===null?'—':format(left)}</span><Icon className={`h-4 w-4 ${improved?'text-emerald-300':declined?'text-rose-300':'text-slate-600'}`}/><strong className="text-sm text-slate-100">{right===null?'—':format(right)}</strong></div></div>;}
