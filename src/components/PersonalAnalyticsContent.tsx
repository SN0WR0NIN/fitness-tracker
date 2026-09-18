'use client';

import { useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, CalendarDays, Target, TrendingUp } from 'lucide-react';
import { personalMetrics, type MetricActivity } from '@/lib/personal-metrics';
import { formatPace } from '@/lib/format';
import { DEFAULT_SCORING_RULES, type ScoringRules } from '@/lib/scoring';
import WeeklyRecapCard from '@/components/WeeklyRecapCard';
import type { AnalyticsView } from '@/components/PersonalAnalytics';

type GoalHistory = { weekNumber:number; dateRange:string; points:number; target:number; achieved:boolean; current:boolean };
type WeeklyScore = { weekNumber:number; totalPoints:number };
type TrendMetric = 'points'|'distance'|'pace';
type TrendScope = 'daily'|'weekly';

type Props = {
  activities: MetricActivity[];
  today: string;
  scoringRules?: ScoringRules;
  view: Exclude<AnalyticsView,'history'>;
  name: string;
  columnName?: string | null;
  rank?: number | null;
  participantCount: number;
  weeklyGoal: number;
  weeklyScores: WeeklyScore[];
  goalHistory: GoalHistory[];
};

export default function PersonalAnalyticsContent({
  activities,today,scoringRules=DEFAULT_SCORING_RULES,view,name,columnName,rank,participantCount,weeklyGoal,weeklyScores,goalHistory,
}: Props) {
  const data=useMemo(()=>personalMetrics(activities,today,scoringRules),[activities,today,scoringRules]);
  const [trendMetric,setTrendMetric]=useState<TrendMetric>('points');
  const [trendScope,setTrendScope]=useState<TrendScope>('daily');
  const [sportKey,setSportKey]=useState('');
  const panel='rounded-2xl border border-white/10 bg-slate-900/60 p-5 sm:p-6';
  const dateLabel=(date:string)=>new Date(`${date}T12:00:00Z`).toLocaleDateString('en-SG',{timeZone:'UTC',day:'numeric',month:'short'});
  const dateLabelLong=(date:string|null|undefined)=>date?new Date(`${date}T12:00:00Z`).toLocaleDateString('en-SG',{timeZone:'UTC',day:'numeric',month:'short',year:'numeric'}):'—';

  const strongestShare=data.total&&data.strongestSport?data.strongestSport.points/data.total*100:0;
  const remainingToTarget=Math.max(0,weeklyGoal-data.currentWeekPoints);
  const weekInsight=data.weekChange===null
    ? (data.currentWeekPoints>0?'You are scoring in a new comparison week.':'No approved points recorded this week yet.')
    : `${Math.abs(data.weekChange).toFixed(0)}% ${data.weekChange>=0?'more':'fewer'} points than last week.`;
  const sportInsight=data.strongestSport
    ? `${data.strongestSport.label} contributes ${strongestShare.toFixed(0)}% of your season points.`
    : 'Complete an approved activity to reveal your strongest sport.';
  const targetInsight=remainingToTarget===0
    ? `Weekly target cleared by ${Math.max(0,data.currentWeekPoints-weeklyGoal).toFixed(1)} pts.`
    : `${remainingToTarget.toFixed(1)} pts to your ${weeklyGoal.toFixed(0)}-point weekly target.`;

  const scoreMixTotal=data.scoreMix.distancePoints+data.scoreMix.pacePoints+data.scoreMix.friendBonus;
  const mix=[
    {label:'Distance',value:data.scoreMix.distancePoints,className:'bg-sky-400'},
    {label:'Pace',value:data.scoreMix.pacePoints,className:'bg-lime-300'},
    {label:'Friend',value:data.scoreMix.friendBonus,className:'bg-pink-400'},
  ];

  const progressSummary=[
    {label:'This week',value:`${data.currentWeekPoints.toFixed(1)} pts`,detail:`Week ${data.currentWeek}`},
    {label:'Vs last week',value:data.weekChange===null?'—':`${data.weekChange>=0?'+':''}${data.weekChange.toFixed(0)}%`,detail:data.previousWeekPoints?`${data.previousWeekPoints.toFixed(1)} pts previous`:'No baseline'},
    {label:'Avg activity',value:`${data.currentWeekAveragePoints.toFixed(1)} pts`,detail:'Current week'},
    {label:'Best day',value:data.bestDay?`${data.bestDay.points.toFixed(1)} pts`:'—',detail:data.bestDay?dateLabel(data.bestDay.date):'No scored day'},
  ];

  const selectedSport=data.categories.find(item=>item.key===sportKey)
    ?? data.strongestSport
    ?? data.categories[0];
  const sportShare=data.total?selectedSport.points/data.total*100:0;
  const sportDistance=selectedSport.key==='SWIM'
    ? `${(selectedSport.distance*1000).toFixed(0)} m`
    : selectedSport.key==='TROOP_GAMES'
      ? '—'
      : `${selectedSport.distance.toFixed(1)} km`;

  const pb=data.personalBests;
  const pbCards=[
    {
      icon:'🏃',label:'Longest run',value:pb.longestRun?`${pb.longestRun.value.toFixed(2)} km`:'—',
      meta:recordMeta(pb.longestRun?.date,pb.longestRun?.improvement===null||pb.longestRun?.improvement===undefined?null:`+${pb.longestRun.improvement.toFixed(2)} km vs prior PB`,dateLabelLong),
      recent:pb.longestRun?.recent??false,
    },
    {
      icon:'🚴',label:'Longest ride',value:pb.longestRide?`${pb.longestRide.value.toFixed(2)} km`:'—',
      meta:recordMeta(pb.longestRide?.date,pb.longestRide?.improvement===null||pb.longestRide?.improvement===undefined?null:`+${pb.longestRide.improvement.toFixed(2)} km vs prior PB`,dateLabelLong),
      recent:pb.longestRide?.recent??false,
    },
    {
      icon:'🏊',label:'Longest swim',value:pb.longestSwim?`${pb.longestSwim.value.toFixed(0)} m`:'—',
      meta:recordMeta(pb.longestSwim?.date,pb.longestSwim?.improvement===null||pb.longestSwim?.improvement===undefined?null:`+${pb.longestSwim.improvement.toFixed(0)} m vs prior PB`,dateLabelLong),
      recent:pb.longestSwim?.recent??false,
    },
    {
      icon:'🥾',label:'Longest walk / hike',value:pb.longestHike?`${pb.longestHike.value.toFixed(2)} km`:'—',
      meta:recordMeta(pb.longestHike?.date,pb.longestHike?.improvement===null||pb.longestHike?.improvement===undefined?null:`+${pb.longestHike.improvement.toFixed(2)} km vs prior PB`,dateLabelLong),
      recent:pb.longestHike?.recent??false,
    },
    {
      icon:'⚡',label:'Fastest run pace',value:pb.fastestPace?`${formatPace(pb.fastestPace.value)}/km`:'—',
      meta:recordMeta(pb.fastestPace?.date,pb.fastestPace?.improvementSeconds===null||pb.fastestPace?.improvementSeconds===undefined?null:`${pb.fastestPace.improvementSeconds.toFixed(0)}s faster than prior PB`,dateLabelLong),
      recent:pb.fastestPace?.recent??false,
    },
    {
      icon:'🔥',label:'Best scoring week',value:pb.bestWeek?`${pb.bestWeek.points.toFixed(1)} pts`:'—',
      meta:pb.bestWeek?`Week ${pb.bestWeek.week} · season high`:'No scored week yet',
      recent:pb.bestWeek?.week===data.currentWeek,
    },
    {
      icon:'📅',label:'Longest active streak',value:`${pb.bestStreak.value} ${pb.bestStreak.value===1?'day':'days'}`,
      meta:pb.bestStreak.endDate?`Ended ${dateLabelLong(pb.bestStreak.endDate)}`:'No streak yet',
      recent:Boolean(pb.bestStreak.endDate&&dayDiff(pb.bestStreak.endDate,today)<=14),
    },
  ];

  if(view==='overview') return <div className="space-y-4">
    <section className="grid gap-3 sm:grid-cols-3">
      <InsightCard icon={<TrendingUp className="h-4 w-4"/>} label="Momentum" text={weekInsight} tone={data.weekChange!==null&&data.weekChange<0?'warn':'good'}/>
      <InsightCard icon={<Target className="h-4 w-4"/>} label="Weekly target" text={targetInsight} tone={remainingToTarget===0?'good':'neutral'}/>
      <InsightCard icon={<ArrowUpRight className="h-4 w-4"/>} label="Strongest sport" text={sportInsight} tone="neutral"/>
    </section>

    <WeeklyRecapCard
      activities={activities}
      today={today}
      name={name}
      columnName={columnName}
      rank={rank}
      participantCount={participantCount}
      weeklyScores={weeklyScores}
      goalHistory={goalHistory}
      embedded
      compact
    />

    <section className={panel}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-lime-300">Season snapshot</p><h2 className="mt-1 text-lg font-black">The essentials</h2></div>
        <p className="text-xs text-slate-500">Approved activities only</p>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniStat label="Approved" value={data.approvedActivities.toString()}/>
        <MiniStat label="Distance" value={`${data.totalDistance.toFixed(1)} km`}/>
        <MiniStat label="Avg / activity" value={`${data.averagePoints.toFixed(1)} pts`}/>
        <MiniStat label="Current streak" value={`${data.currentStreak}d`}/>
      </div>
    </section>

    <section className={panel}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-sky-300">Score mix</p><h2 className="mt-1 text-lg font-black">How you earned your points</h2></div>
        <strong className="text-sm text-slate-300">{scoreMixTotal.toFixed(1)} pts</strong>
      </div>
      <div className="mt-5 flex h-3 overflow-hidden rounded-full bg-white/5">
        {mix.map(item=>{
          const share=scoreMixTotal?item.value/scoreMixTotal*100:0;
          return <div key={item.label} className={item.className} style={{width:`${share}%`}} title={`${item.label}: ${item.value.toFixed(1)} pts`}/>;
        })}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {mix.map(item=><div key={item.label} className="rounded-xl border border-white/5 bg-black/10 p-3"><div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${item.className}`}/><span className="text-[0.68rem] text-slate-500">{item.label}</span></div><p className="mt-2 font-black">{item.value.toFixed(1)}</p></div>)}
      </div>
    </section>
  </div>;

  if(view==='progress') return <div className="space-y-4">
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {progressSummary.map(item=><MiniStat key={item.label} label={item.label} value={item.value} detail={item.detail}/>)}
    </section>

    <TrendExplorer
      data={data}
      metric={trendMetric}
      scope={trendScope}
      setMetric={setTrendMetric}
      setScope={setTrendScope}
      goalHistory={goalHistory}
      dateLabel={dateLabel}
    />
  </div>;

  return <div className="space-y-4">
    <section className={panel}>
      <div>
        <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-violet-300">Sport breakdown</p>
        <h2 className="mt-1 text-lg font-black">Explore one sport at a time</h2>
        <p className="mt-1 text-xs text-slate-400">Points, distance, volume and average performance in one view.</p>
      </div>
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {data.categories.map(item=><button key={item.key} type="button" onClick={()=>setSportKey(item.key)} className={`shrink-0 rounded-xl border px-3 py-2 text-xs font-black transition ${selectedSport.key===item.key?'border-lime-300/30 bg-lime-300/[0.09] text-lime-200':'border-white/10 bg-black/10 text-slate-400 hover:text-white'}`}>{item.label}</button>)}
      </div>
      <div className="mt-4 rounded-2xl border border-white/8 bg-black/10 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><p className="text-sm font-black">{selectedSport.label}</p><p className="mt-1 text-xs text-slate-500">{sportShare.toFixed(0)}% of season points</p></div>
          <p className="text-3xl font-black" style={{color:selectedSport.colour}}>{selectedSport.points.toFixed(1)} <span className="text-xs text-slate-500">pts</span></p>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full" style={{width:`${sportShare}%`,background:selectedSport.colour}}/></div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniStat label="Activities" value={selectedSport.activities.toString()}/>
          <MiniStat label="Distance" value={sportDistance}/>
          <MiniStat label="Avg points" value={`${selectedSport.averagePoints.toFixed(1)}`}/>
          <MiniStat label="Avg pace" value={selectedSport.averagePace?`${formatPace(selectedSport.averagePace)}/km`:'—'}/>
        </div>
      </div>
    </section>

    <section>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-yellow-300">Personal bests</p><h2 className="mt-1 text-lg font-black">Your best approved efforts</h2><p className="mt-1 text-xs text-slate-400">Dates and improvement context make each record easier to understand.</p></div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {pbCards.map(card=><PbCard key={card.label} {...card}/>)}
      </div>
    </section>
  </div>;
}

function TrendExplorer({
  data,metric,scope,setMetric,setScope,goalHistory,dateLabel,
}:{
  data:ReturnType<typeof personalMetrics>;
  metric:TrendMetric;
  scope:TrendScope;
  setMetric:(value:TrendMetric)=>void;
  setScope:(value:TrendScope)=>void;
  goalHistory:GoalHistory[];
  dateLabel:(date:string)=>string;
}) {
  const rows=scope==='daily'
    ? data.days.map(item=>({key:item.date,label:dateLabel(item.date),points:item.points,distance:item.distance,pace:item.pace,weekNumber:null as number|null}))
    : data.weekSeries.map(item=>({key:String(item.weekNumber),label:`W${item.weekNumber}`,points:item.points,distance:item.distance,pace:item.pace,weekNumber:item.weekNumber}));
  const valueFor=(row:(typeof rows)[number])=>metric==='points'?row.points:metric==='distance'?row.distance:row.pace;
  const valid=rows.map(valueFor).filter((value):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>0);
  const maximum=Math.max(1,...valid);
  const minimum=valid.length?Math.min(...valid):0;
  const metricLabel=metric==='points'?'Points':metric==='distance'?'Distance':'Run pace';
  const format=(value:number|null)=>value===null?'—':metric==='points'?`${value.toFixed(1)}`:metric==='distance'?`${value.toFixed(1)} km`:`${formatPace(value)}/km`;
  const barHeight=(value:number|null)=>{
    if(value===null||value<=0)return 3;
    if(metric!=='pace')return Math.max(8,value/maximum*92);
    if(maximum===minimum)return 72;
    return 28+(maximum-value)/(maximum-minimum)*64;
  };

  return <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-sky-300">Trend explorer</p><h2 className="mt-1 text-lg font-black">{metricLabel} over time</h2><p className="mt-1 text-xs text-slate-400">{metric==='pace'?'Lower pace is faster. Run activities only.':'Switch metric or time scale without loading another chart.'}</p></div>
      <div className="flex flex-col gap-2 sm:items-end">
        <div className="flex rounded-xl border border-white/10 bg-black/15 p-1">
          {(['points','distance','pace'] as const).map(value=><button key={value} type="button" onClick={()=>setMetric(value)} className={`rounded-lg px-3 py-2 text-xs font-black capitalize ${metric===value?'bg-lime-300 text-slate-950':'text-slate-400'}`}>{value}</button>)}
        </div>
        <div className="flex gap-1 text-xs">
          {(['daily','weekly'] as const).map(value=><button key={value} type="button" onClick={()=>setScope(value)} className={`rounded-lg border px-3 py-1.5 font-bold capitalize ${scope===value?'border-sky-300/30 bg-sky-300/10 text-sky-200':'border-white/10 text-slate-500'}`}>{value}</button>)}
        </div>
      </div>
    </div>

    <div className="mt-6 flex min-h-48 gap-2 overflow-x-auto pb-2">
      {rows.map(row=>{
        const value=valueFor(row);
        const goal=row.weekNumber?goalHistory.find(item=>item.weekNumber===row.weekNumber):null;
        return <div key={row.key} className="flex min-w-[4.5rem] flex-1 flex-col justify-end">
          <p className="mb-2 min-h-5 text-center text-[0.65rem] font-black text-slate-300">{format(value)}</p>
          <div className="relative flex h-36 items-end justify-center rounded-t-xl bg-white/[0.02]">
            <div className={`w-8 rounded-t-lg transition-[height] duration-500 ${metric==='pace'?'bg-violet-400':metric==='distance'?'bg-sky-400':'bg-lime-300'}`} style={{height:`${barHeight(value)}%`}}/>
          </div>
          <p className="mt-2 text-center text-[0.68rem] font-bold text-slate-500">{row.label}</p>
          {scope==='weekly'&&metric==='points'?<p className={`mt-1 text-center text-[0.58rem] ${goal?.achieved?'text-emerald-300':'text-slate-600'}`}>{goal?`${goal.target.toFixed(0)} target`:'—'}</p>:null}
        </div>;
      })}
    </div>
  </section>;
}

function InsightCard({icon,label,text,tone}:{icon:React.ReactNode;label:string;text:string;tone:'good'|'warn'|'neutral'}) {
  const style=tone==='good'?'border-emerald-400/15 bg-emerald-400/[0.05]':tone==='warn'?'border-amber-400/20 bg-amber-400/[0.06]':'border-white/10 bg-white/[0.035]';
  return <div className={`rounded-2xl border p-4 ${style}`}><div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-500"><span className={tone==='warn'?'text-amber-300':tone==='good'?'text-emerald-300':'text-sky-300'}>{icon}</span>{label}</div><p className="mt-3 text-sm font-bold leading-5 text-slate-200">{text}</p></div>;
}

function MiniStat({label,value,detail}:{label:string;value:string;detail?:string}) {
  return <div className="rounded-xl border border-white/8 bg-black/10 p-3 sm:p-4"><p className="text-[0.65rem] font-black uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-lg font-black text-slate-100">{value}</p>{detail?<p className="mt-1 text-[0.68rem] text-slate-600">{detail}</p>:null}</div>;
}

function PbCard({icon,label,value,meta,recent}:{icon:string;label:string;value:string;meta:string;recent:boolean}) {
  return <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><p className="text-xs text-slate-400"><span className="mr-2 text-lg">{icon}</span>{label}</p>{recent?<span className="rounded-full bg-lime-300/10 px-2 py-1 text-[0.6rem] font-black uppercase tracking-wide text-lime-300">Recent PB</span>:null}</div><p className="mt-3 text-xl font-black text-white">{value}</p><p className="mt-2 text-xs leading-5 text-slate-500">{meta}</p></div>;
}

function recordMeta(date:string|undefined,improvement:string|null,dateLabel:(date:string|null|undefined)=>string) {
  if(!date)return 'No approved record yet';
  return improvement?`${dateLabel(date)} · ${improvement}`:dateLabel(date);
}

function dayDiff(date:string,today:string) {
  return Math.floor((new Date(`${today}T00:00:00Z`).getTime()-new Date(`${date}T00:00:00Z`).getTime())/86400000);
}
