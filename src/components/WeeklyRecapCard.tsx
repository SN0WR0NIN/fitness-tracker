'use client';

import { useMemo, useState } from 'react';
import { Download, Share2, Sparkles } from 'lucide-react';
import { getWeekNumber } from '@/lib/scoring';

const categoryLabels: Record<string,string> = {RUN:'Run',CYCLE:'Cycle',SWIM:'Swim',WALK_OR_HIKE:'Walk / Hike',TROOP_GAMES:'Troop Games'};

type RecapActivity = {
  category: string;
  distance: number;
  points: number;
  status: string;
  occurredAt: string;
  completedWithFriend: boolean;
};
type WeekScore = { weekNumber:number; totalPoints:number };
type GoalHistory = { weekNumber:number; dateRange:string; points:number; target:number; achieved:boolean; current:boolean };

type Props = {
  activities: RecapActivity[];
  today?: string;
  name?: string;
  columnName?: string | null;
  rank?: number | null;
  participantCount?: number;
  weeklyScores?: WeekScore[];
  goalHistory?: GoalHistory[];
};

function distanceKm(activity:RecapActivity){return activity.category==='SWIM'?activity.distance/1000:activity.category==='TROOP_GAMES'?0:activity.distance;}

export default function WeeklyRecapCard({activities,today,name='My weekly recap',columnName=null,rank=null,participantCount=0,weeklyScores=[],goalHistory=[]}:Props){
  const [message,setMessage]=useState('');
  const recap=useMemo(()=>{
    const reference=today?new Date(`${today}T04:00:00Z`):new Date();
    const currentWeek=getWeekNumber(reference);
    const latestScored=Math.max(0,...weeklyScores.map(item=>item.weekNumber));
    const weekNumber=Math.max(1,currentWeek>0?currentWeek:latestScored);
    const rows=activities.filter(activity=>activity.status==='APPROVED'&&getWeekNumber(new Date(activity.occurredAt))===weekNumber);
    const score=weeklyScores.find(item=>item.weekNumber===weekNumber)?.totalPoints??rows.reduce((sum,item)=>sum+item.points,0);
    const goal=goalHistory.find(item=>item.weekNumber===weekNumber);
    const distance=rows.reduce((sum,item)=>sum+distanceKm(item),0);
    const buddySessions=rows.filter(item=>item.completedWithFriend).length;
    const best=[...rows].sort((a,b)=>b.points-a.points)[0]??null;
    const categoryTotals=new Map<string,number>();for(const row of rows)categoryTotals.set(row.category,(categoryTotals.get(row.category)||0)+row.points);
    const strongest=[...categoryTotals].sort((a,b)=>b[1]-a[1])[0];
    return {weekNumber,rows,score,goal,distance,buddySessions,best,strongest,dateRange:goal?.dateRange??`Week ${weekNumber}`};
  },[activities,goalHistory,today,weeklyScores]);

  const buildImage=async()=>{
    const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1350;
    const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas unavailable');
    const bg=ctx.createLinearGradient(0,0,1080,1350);bg.addColorStop(0,'#07101f');bg.addColorStop(.55,'#0f172a');bg.addColorStop(1,'#111827');ctx.fillStyle=bg;ctx.fillRect(0,0,1080,1350);
    const glow=ctx.createRadialGradient(920,130,20,920,130,480);glow.addColorStop(0,'rgba(180,255,69,.22)');glow.addColorStop(1,'rgba(180,255,69,0)');ctx.fillStyle=glow;ctx.fillRect(0,0,1080,700);
    const orange=ctx.createRadialGradient(120,1220,10,120,1220,420);orange.addColorStop(0,'rgba(251,146,60,.18)');orange.addColorStop(1,'rgba(251,146,60,0)');ctx.fillStyle=orange;ctx.fillRect(0,750,700,600);
    const roundRect=(x:number,y:number,w:number,h:number,r:number,fill:string,stroke?:string)=>{ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke();}};
    ctx.fillStyle='#b4ff45';ctx.font='700 30px Arial, sans-serif';ctx.fillText('KG STAY ACTIVE CHALLENGE',72,92);
    ctx.fillStyle='#94a3b8';ctx.font='600 24px Arial, sans-serif';ctx.fillText(`WEEK ${recap.weekNumber} RECAP`,72,140);
    ctx.fillStyle='#f8fafc';ctx.font='800 58px Arial, sans-serif';ctx.fillText(name.slice(0,28),72,235);
    ctx.fillStyle='#94a3b8';ctx.font='500 26px Arial, sans-serif';ctx.fillText(`${columnName??'Performance recap'} · ${recap.dateRange}`,72,282);
    roundRect(70,340,940,280,36,'rgba(255,255,255,.045)','rgba(255,255,255,.10)');
    ctx.fillStyle='#94a3b8';ctx.font='700 24px Arial, sans-serif';ctx.fillText('WEEKLY POINTS',112,405);
    ctx.fillStyle='#b4ff45';ctx.font='900 124px Arial, sans-serif';ctx.fillText(recap.score.toFixed(1),106,535);
    ctx.fillStyle='#cbd5e1';ctx.font='700 30px Arial, sans-serif';ctx.fillText('points',ctx.measureText(recap.score.toFixed(1)).width+130,530);
    const rankText=rank&&participantCount?`Season rank #${rank} of ${participantCount}`:`${recap.rows.length} approved ${recap.rows.length===1?'activity':'activities'} this week`;
    ctx.fillStyle='#f8fafc';ctx.font='700 27px Arial, sans-serif';ctx.fillText(rankText,112,585);
    const stats=[['ACTIVITIES',String(recap.rows.length)],['DISTANCE',`${recap.distance.toFixed(1)} km`],['BUDDY SESSIONS',String(recap.buddySessions)],['WEEKLY GOAL',recap.goal?`${recap.score.toFixed(1)} / ${recap.goal.target.toFixed(0)}`:'—']];
    stats.forEach((item,index)=>{const col=index%2,row=Math.floor(index/2);const x=70+col*480,y=670+row*190;roundRect(x,y,460,160,28,'rgba(255,255,255,.035)','rgba(255,255,255,.08)');ctx.fillStyle='#64748b';ctx.font='700 19px Arial, sans-serif';ctx.fillText(item[0],x+34,y+50);ctx.fillStyle='#f8fafc';ctx.font='800 42px Arial, sans-serif';ctx.fillText(item[1],x+34,y+108);});
    roundRect(70,1065,940,150,28,'rgba(251,146,60,.08)','rgba(251,146,60,.18)');
    ctx.fillStyle='#fb923c';ctx.font='700 20px Arial, sans-serif';ctx.fillText('TOP ACTIVITY',104,1110);
    ctx.fillStyle='#f8fafc';ctx.font='800 34px Arial, sans-serif';const top=recap.best?`${categoryLabels[recap.best.category]??recap.best.category} · ${recap.best.points.toFixed(1)} pts`:'No approved activity yet';ctx.fillText(top,104,1160);
    if(recap.strongest){ctx.fillStyle='#94a3b8';ctx.font='500 22px Arial, sans-serif';ctx.fillText(`Strongest sport this week: ${categoryLabels[recap.strongest[0]]??recap.strongest[0]}`,104,1195);}
    ctx.fillStyle='#64748b';ctx.font='600 20px Arial, sans-serif';ctx.fillText('kgstayactivechallenge.app',72,1292);ctx.textAlign='right';ctx.fillText('Keep moving. Keep scoring.',1008,1292);ctx.textAlign='left';
    return await new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Image export failed')),'image/png'));
  };

  const saveImage=async()=>{try{setMessage('Preparing recap…');const blob=await buildImage();const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`kg-week-${recap.weekNumber}-recap.png`;a.click();URL.revokeObjectURL(url);setMessage('Recap image saved.');}catch{setMessage('Could not create the recap image on this device.');}};
  const shareRecap=async()=>{try{setMessage('Preparing recap…');const blob=await buildImage();const file=new File([blob],`kg-week-${recap.weekNumber}-recap.png`,{type:'image/png'});const text=`KG Stay Active · Week ${recap.weekNumber}: ${recap.score.toFixed(1)} pts, ${recap.rows.length} activities, ${recap.distance.toFixed(1)} km.`;if(navigator.share&&navigator.canShare?.({files:[file]})){await navigator.share({title:`KG Week ${recap.weekNumber} recap`,text,files:[file]});setMessage('Recap shared.');return;}if(navigator.share){await navigator.share({title:`KG Week ${recap.weekNumber} recap`,text,url:window.location.origin});setMessage('Recap shared.');return;}await navigator.clipboard.writeText(`${text} ${window.location.origin}`);setMessage('Recap summary copied to clipboard.');}catch(error){if((error as Error)?.name!=='AbortError')setMessage('Sharing was not available on this device.');}};

  return <details open className="dashboard-fold"><summary>Weekly recap card</summary><section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
    <div className="overflow-hidden rounded-3xl border border-lime-300/15 bg-[radial-gradient(circle_at_top_right,_rgba(180,255,69,0.16),_transparent_34%),radial-gradient(circle_at_bottom_left,_rgba(251,146,60,0.12),_transparent_36%),#0f172a] p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-lime-300"><Sparkles className="h-4 w-4" />Week {recap.weekNumber} recap</p><h2 className="mt-3 text-3xl font-black sm:text-4xl">{name}</h2><p className="mt-1 text-sm text-slate-400">{columnName??'Performance recap'} · {recap.dateRange}</p></div><div className="text-right"><p className="text-5xl font-black text-lime-300">{recap.score.toFixed(1)}</p><p className="text-xs font-bold uppercase tracking-wide text-slate-500">weekly points</p></div></div>
      <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4"><RecapStat label="Activities" value={recap.rows.length.toString()}/><RecapStat label="Distance" value={`${recap.distance.toFixed(1)} km`}/><RecapStat label="Buddy sessions" value={recap.buddySessions.toString()}/><RecapStat label="Weekly goal" value={recap.goal?`${recap.score.toFixed(1)} / ${recap.goal.target.toFixed(0)}`:'—'}/></div>
      <div className="mt-4 rounded-2xl border border-orange-400/15 bg-orange-400/[0.06] p-4"><p className="text-[0.68rem] font-black uppercase tracking-wide text-orange-300">Top activity</p><p className="mt-1 font-black text-slate-100">{recap.best?`${categoryLabels[recap.best.category]??recap.best.category} · ${recap.best.points.toFixed(1)} pts`:'No approved activity yet'}</p>{recap.strongest?<p className="mt-1 text-xs text-slate-400">Strongest sport: {categoryLabels[recap.strongest[0]]??recap.strongest[0]}</p>:null}</div>
    </div>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p role="status" className="text-xs text-slate-500">{message||'Share through your device or save a 1080×1350 PNG.'}</p><div className="flex gap-2"><button type="button" onClick={saveImage} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm font-bold text-slate-300 transition hover:bg-white/5"><Download className="h-4 w-4"/>Save image</button><button type="button" onClick={shareRecap} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-lime-300 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-lime-200"><Share2 className="h-4 w-4"/>Share recap</button></div></div>
  </section></details>;
}

function RecapStat({label,value}:{label:string;value:string}){return <div className="rounded-xl border border-white/5 bg-black/15 p-4"><p className="text-[0.65rem] font-black uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-xl font-black text-white">{value}</p></div>;}
