'use client';

import { useId, useMemo, useState } from 'react';
import { personalMetrics, type MetricActivity } from '@/lib/personal-metrics';
import { formatPace } from '@/lib/format';
import { DEFAULT_SCORING_RULES, type ScoringRules } from '@/lib/scoring';
import WeeklyRecapCard from '@/components/WeeklyRecapCard';

type Props = { activities: MetricActivity[]; today: string; scoringRules?: ScoringRules; weeklyChart?: React.ReactNode };

export default function PersonalAnalyticsContent({activities,today,scoringRules=DEFAULT_SCORING_RULES,weeklyChart}: Props) {
  const data=useMemo(()=>personalMetrics(activities,today,scoringRules),[activities,today,scoringRules]);
  const [day,setDay]=useState(6),[category,setCategory]=useState<string|null>(null);
  const gradient=useId();
  const max=Math.max(10,...data.days.map(d=>d.points))*1.1;
  const coords=data.days.map((d,i)=>({x:40+i*90,y:205-d.points/max*165}));
  const line=coords.map((p,i)=>`${i?'L':'M'}${p.x},${p.y}`).join(' ');
  const selected=data.categories.find(c=>c.key===category);
  const maxDistance=Math.max(1,...data.categories.map(c=>c.distance));
  const panel='rounded-2xl border border-white/10 bg-slate-900/60 p-5 sm:p-6';
  const dateLabel=(date:string)=>new Date(`${date}T12:00:00Z`).toLocaleDateString('en-SG',{timeZone:'UTC',day:'numeric',month:'short'});
  const cards=[
    ['🏃','Longest run',data.longestRun?`${data.longestRun.toFixed(2)} km`:'—','#b4ff45'],
    ['🚴','Longest ride',data.longestRide?`${data.longestRide.toFixed(2)} km`:'—','#40d4f4'],
    ['🏊','Longest swim',data.longestSwim?`${data.longestSwim.toFixed(0)} m`:'—','#a78bfa'],
    ['🥾','Longest walk / hike',data.longestHike?`${data.longestHike.toFixed(2)} km`:'—','#fb923c'],
    ['⚡','Fastest run pace',data.fastestPace?`${formatPace(data.fastestPace)} /km`:'—','#b4ff45'],
    ['🎯','Average run pace',data.averageRunPace?`${formatPace(data.averageRunPace)} /km`:'—','#facc15'],
    ['🔥','Best week',data.bestWeek?`${data.bestWeek.points.toFixed(1)} pts · W${data.bestWeek.week}`:'—','#fb923c'],
    ['📅','Longest active streak',`${data.bestStreak} ${data.bestStreak===1?'day':'days'}`,'#40d4f4'],
    ['👥','Buddy sessions',`${data.buddies} ${data.buddies===1?'activity':'activities'}`,'#f472b6'],
  ];
  const scoreMixTotal=data.scoreMix.distancePoints+data.scoreMix.pacePoints+data.scoreMix.friendBonus;
  const mix=[
    {label:'Distance points',value:data.scoreMix.distancePoints,colour:'#40d4f4'},
    {label:'Pace points',value:data.scoreMix.pacePoints,colour:'#b4ff45'},
    {label:'Friend bonus',value:data.scoreMix.friendBonus,colour:'#f472b6'},
  ];
  const weekTrend=data.weekChange===null
    ? data.currentWeekPoints>0&&data.previousWeekPoints===0?'New scoring week':'No previous-week baseline'
    : `${data.weekChange>=0?'+':''}${data.weekChange.toFixed(0)}% vs last week`;
  const summaryCards=[
    ['Approved sessions',data.approvedActivities.toString()],
    ['Active days',data.activeDays.toString()],
    ['Total distance',`${data.totalDistance.toFixed(1)} km`],
    ['Avg points / session',data.averagePoints.toFixed(1)],
    ['Current streak',`${data.currentStreak} ${data.currentStreak===1?'day':'days'}`],
    ['Strongest sport',data.strongestSport?.label??'—'],
  ];
  return <div className="space-y-6 pt-3">
    <WeeklyRecapCard activities={activities} today={today} />

    <details open className="dashboard-fold"><summary>Season snapshot</summary><section className={panel}>
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-black">Season snapshot</h2><p className="mt-1 text-xs text-slate-400">Approved activity performance only</p></div><div className="text-right"><p className="text-xs text-slate-500">Week {data.currentWeek}</p><p className="text-lg font-black text-lime-300">{data.currentWeekPoints.toFixed(1)} pts</p><p className="text-xs text-slate-400">{weekTrend}</p></div></div>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">{summaryCards.map(([label,value])=><div key={label} className="rounded-xl border border-white/5 bg-black/10 p-4"><p className="text-[0.68rem] uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-lg font-black text-slate-100">{value}</p></div>)}</div>
    </section></details>

    <details open className="dashboard-fold"><summary>Score composition</summary><section className={panel}>
      <h2 className="text-lg font-black">Where your points came from</h2><p className="mt-1 text-xs text-slate-400">Distance, running pace and friend-bonus contributions from saved approved score logs</p>
      <div className="mt-5 space-y-4">{mix.map(item=>{const share=scoreMixTotal?item.value/scoreMixTotal*100:0;return <div key={item.label}><div className="flex items-center justify-between gap-3 text-sm"><span className="text-slate-300">{item.label}</span><strong>{item.value.toFixed(1)} pts</strong></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full transition-[width] duration-700" style={{width:`${share}%`,background:item.colour}}/></div></div>;})}</div>
      {!scoreMixTotal?<p className="mt-4 text-xs text-slate-500">Score components will appear after approved activities have saved point logs.</p>:null}
    </section></details>

    <details open className="dashboard-fold"><summary>28-day consistency</summary><section className={panel}>
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-black">28-day consistency</h2><p className="mt-1 text-xs text-slate-400">One tile per Singapore calendar day</p></div><div className="text-right text-xs text-slate-400"><span className="font-black text-lime-300">{data.currentStreak}</span> current · <span className="font-black text-sky-300">{data.bestStreak}</span> best</div></div>
      <div className="mt-5 grid grid-cols-7 gap-2">{data.consistency.map(dayItem=>{const intensity=Math.min(1,dayItem.points/25);return <div key={dayItem.date} title={`${dateLabel(dayItem.date)} · ${dayItem.activities} activities · ${dayItem.points.toFixed(1)} pts`} className={`aspect-square rounded-lg border transition ${dayItem.active?'border-lime-300/20':'border-white/5'}`} style={{background:dayItem.active?`rgba(180,255,69,${0.16+intensity*0.54})`:'rgba(255,255,255,0.025)'}}><span className="sr-only">{dayItem.date}: {dayItem.points.toFixed(1)} points</span></div>;})}</div>
      <div className="mt-3 flex items-center justify-between text-[0.65rem] text-slate-500"><span>{dateLabel(data.consistency[0].date)}</span><span>More activity → brighter tile</span><span>{dateLabel(data.consistency[data.consistency.length-1].date)}</span></div>
    </section></details>

    <div className="space-y-6">
      <details open className="dashboard-fold"><summary>Points — last 7 days</summary><section className={panel}><h2 className="text-lg font-black">Points — last 7 days</h2><p role="status" className="mt-2 text-sm text-lime-300">{dateLabel(data.days[day].date)} · {data.days[day].points.toFixed(1)} points</p>
        <svg viewBox="0 0 620 240" role="img" aria-label="Daily approved points over the last seven Singapore dates" className="mt-3 w-full overflow-visible"><defs><linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#b4ff45" stopOpacity=".3"/><stop offset="100%" stopColor="#b4ff45" stopOpacity="0"/></linearGradient></defs>
          {[0,.25,.5,.75,1].map(n=><g key={n}><line x1="40" x2="580" y1={205-n*165} y2={205-n*165} stroke="#ffffff12"/><text x="30" y={209-n*165} textAnchor="end" fontSize="10" fill="#94a3b8">{(n*max).toFixed(0)}</text></g>)}
          <path d={`${line} L580,205 L40,205 Z`} fill={`url(#${gradient})`} className="analytics-fade"/>
          <path d={line} fill="none" stroke="#b4ff45" strokeWidth="3" strokeLinejoin="round" pathLength="1" className="analytics-line"/>
          {coords.map((p,i)=><g key={i}><circle cx={p.x} cy={p.y} r={day===i?6:4} fill="#b4ff45"/><text x={p.x} y="230" textAnchor="middle" fontSize="10" fill="#94a3b8">{dateLabel(data.days[i].date)}</text></g>)}
        </svg><div className="mt-2 grid grid-cols-7 gap-1">{data.days.map((d,i)=><button key={d.date} type="button" onMouseEnter={()=>setDay(i)} onFocus={()=>setDay(i)} onClick={()=>setDay(i)} aria-pressed={day===i} className={`min-h-11 rounded-lg text-xs focus-visible:ring-2 focus-visible:ring-lime-300 ${day===i?'bg-lime-300/15 text-lime-300':'text-slate-400 hover:bg-white/5'}`} aria-label={`${dateLabel(d.date)}: ${d.points.toFixed(1)} points`}>{d.points.toFixed(1)}</button>)}</div><p className="mt-3 text-xs text-slate-500">Singapore dates · Tap or hover a daily value</p>
      </section></details>
      {weeklyChart}
      <details open className="dashboard-fold"><summary>Points by activity type</summary><section className={panel}><h2 className="text-lg font-black">Points by activity type</h2><div className="relative mx-auto my-5 h-44 w-44"><svg viewBox="0 0 120 120" role="img" aria-label="Share of all approved points by activity type" className="h-full w-full -rotate-90 analytics-fade"><circle cx="60" cy="60" r="43" fill="none" stroke="#ffffff0d" strokeWidth="18"/>{data.categories.map((c,index)=>{const portion=data.total?c.points/data.total*100:0;const start=data.total?data.categories.slice(0,index).reduce((sum,item)=>sum+item.points,0)/data.total*100:0;return <circle key={c.key} cx="60" cy="60" r="43" pathLength="100" fill="none" stroke={c.colour} strokeWidth={category===c.key?21:18} strokeDasharray={`${portion} ${100-portion}`} strokeDashoffset={-start} className="transition-all duration-300"/>;})}</svg><div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><strong className="text-2xl">{(selected?.points??data.total).toFixed(1)}</strong><span className="text-xs text-slate-400">{selected?.label??'Total points'}</span></div></div><div className="space-y-1">{data.categories.map(c=><button type="button" key={c.key} onMouseEnter={()=>setCategory(c.key)} onFocus={()=>setCategory(c.key)} onClick={()=>setCategory(category===c.key?null:c.key)} aria-pressed={category===c.key} className="flex min-h-11 w-full items-center justify-between gap-2 rounded-lg px-2 text-sm hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-lime-300"><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{background:c.colour}}/>{c.label}</span><strong>{c.points.toFixed(1)} pts</strong></button>)}</div>{!data.total?<p className="text-xs text-slate-400">No approved points yet.</p>:null}</section></details>
    </div>
    <details open className="dashboard-fold"><summary>Distance by activity</summary><section className={panel}><h2 className="text-lg font-black">Distance by activity</h2><p className="mt-1 text-xs text-slate-400">All approved distance in kilometres · Swim metres converted to km</p><div className="mt-6 flex gap-3">{data.categories.filter(c=>c.key!=='TROOP_GAMES').map((c,i)=><div key={c.key} className="min-w-0 flex-1 text-center"><p className="mb-2 text-xs font-bold" style={{color:c.colour}}>{c.distance.toFixed(2)} km</p><div className="flex h-36 items-end justify-center border-b border-white/15"><div title={`${c.label}: ${c.distance.toFixed(2)} km`} className="weekly-chart-bar w-3/4 rounded-t-md" style={{height:`${c.distance/maxDistance*100}%`,background:c.colour,animationDelay:`${i*100}ms`}}/></div><p className="mt-3 text-xs text-slate-400">{c.label}</p></div>)}</div></section></details>
    <details open className="dashboard-fold"><summary>Personal bests</summary><section><h2 className="mb-2 text-xl font-black">Personal bests</h2><p className="mb-5 text-xs text-slate-400">Approved activities only · Pace is the fastest average run pace · Streak counts consecutive Singapore dates</p><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{cards.map(([icon,label,value,colour],i)=><div key={label} className={`${panel} analytics-fade`} style={{animationDelay:`${i*50}ms`}}><p className="text-xs text-slate-400"><span className="mr-2 text-lg">{icon}</span>{label}</p><p className="mt-4 text-lg font-black sm:text-xl" style={{color:colour}}>{value}</p></div>)}</div></section></details>
  </div>;
}
