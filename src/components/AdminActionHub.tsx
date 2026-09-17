import Link from 'next/link';
import {
  Award,
  DatabaseBackup,
  FileClock,
  Flag,
  Gauge,
  KeyRound,
  LockKeyhole,
  Megaphone,
  Pencil,
  PlusCircle,
  Settings,
  ShieldAlert,
  SlidersHorizontal,
  Trophy,
  Users,
  Wrench,
} from 'lucide-react';
import { getOperatingState } from '@/lib/operating-mode';

type WeeklyAwardState='FINALIZED'|'READY'|'WAITING_REVIEW'|'NOT_STARTED';
type Tone='neutral'|'good'|'warn'|'danger';
type Badge={label:string;tone?:Tone};
type ActionItem={href:string;label:string;description:string;icon:React.ReactNode;badge?:Badge;featured?:boolean};
type Group={id:string;title:string;subtitle:string;items:ActionItem[]};

type Props={
  pendingReviews:number;
  flaggedReviews:number;
  correctionCount:number;
  duplicateReviews:number;
  dirtyWeekCount:number;
  passwordResets:number;
  latestCompletedWeek:number;
  latestWeekPendingReviews:number;
  weeklyAwardState:WeeklyAwardState;
  healthStatus:string|null;
  finalizedWeeks:number;
  completedWeeks:number;
};

export default async function AdminActionHub(props:Props){
  const state=await getOperatingState();
  const countBadge=(count:number):Badge=>({label:count?String(count):'Clear',tone:count?'warn':'good'});
  const weeklyBadge:Badge=props.dirtyWeekCount?{label:`${props.dirtyWeekCount} rebuild${props.dirtyWeekCount===1?'':'s'}`,tone:'warn'}:props.weeklyAwardState==='FINALIZED'?{label:`Week ${props.latestCompletedWeek} final`,tone:'good'}:props.weeklyAwardState==='READY'?{label:'Ready',tone:'warn'}:props.weeklyAwardState==='WAITING_REVIEW'?{label:`${props.latestWeekPendingReviews} reviews left`,tone:'warn'}:{label:'Not started',tone:'neutral'};
  const finalizationBadge:Badge=props.completedWeeks===0?{label:'No completed weeks',tone:'neutral'}:props.finalizedWeeks>=props.completedWeeks?{label:'Up to date',tone:'good'}:{label:`${props.completedWeeks-props.finalizedWeeks} to finalise`,tone:'warn'};

  const groups:Group[]=[
    {id:'review',title:'Review',subtitle:'Daily queues and competition-integrity decisions.',items:[
      {href:'/admin/activities',label:'Activity review',description:'Approve or reject participant submissions.',icon:<FileClock className="h-5 w-5"/>,badge:countBadge(props.pendingReviews),featured:props.pendingReviews>0},
      {href:'/admin/flagged',label:'Needs Review',description:'Inspect submissions with automated integrity warnings.',icon:<Flag className="h-5 w-5"/>,badge:countBadge(props.flaggedReviews),featured:props.flaggedReviews>0},
      {href:'/admin/corrections',label:'Approved edits',description:'Review participant edits to approved activities.',icon:<Pencil className="h-5 w-5"/>,badge:countBadge(props.correctionCount),featured:props.correctionCount>0},
      {href:'/admin/duplicates',label:'Duplicate review',description:'Compare possible duplicate activities side by side.',icon:<ShieldAlert className="h-5 w-5"/>,badge:countBadge(props.duplicateReviews),featured:props.duplicateReviews>0},
      {href:'/admin/score-overrides',label:'Score overrides',description:'Apply controlled manual score adjustments.',icon:<SlidersHorizontal className="h-5 w-5"/>},
      {href:'/admin/activities/new',label:'Create activity',description:'Add an entry on behalf of a participant.',icon:<PlusCircle className="h-5 w-5"/>},
    ]},
    {id:'competition',title:'Competition',subtitle:'Weeks, awards, seasons and published results.',items:[
      {href:'/admin/weeks',label:'Week finalisation',description:'Freeze completed weeks or reopen them with an audit reason.',icon:<LockKeyhole className="h-5 w-5"/>,badge:finalizationBadge,featured:finalizationBadge.tone==='warn'},
      {href:'/admin/awards',label:'Weekly awards',description:'Generate, finalise or rebuild weekly competition results.',icon:<Award className="h-5 w-5"/>,badge:weeklyBadge,featured:weeklyBadge.tone==='warn'},
      {href:'/admin/recap',label:'Weekly recap',description:'Create the weekly challenge summary and recap.',icon:<Megaphone className="h-5 w-5"/>},
      {href:'/admin/seasons',label:'Season management',description:'Prepare future seasons and control season rollover.',icon:<Trophy className="h-5 w-5"/>},
      {href:'/results',label:'Public results',description:'Open the participant-facing results archive.',icon:<Trophy className="h-5 w-5"/>},
    ]},
    {id:'participants',title:'Participants',subtitle:'People, access and account support.',items:[
      {href:'/admin/users',label:'Manage participants',description:'Participant details, columns and account access.',icon:<Users className="h-5 w-5"/>},
      {href:'/admin/accounts',label:'Account management',description:'Review account state and onboarding information.',icon:<Users className="h-5 w-5"/>},
      {href:'/admin/password-resets',label:'Password resets',description:'Handle active account recovery requests.',icon:<KeyRound className="h-5 w-5"/>,badge:countBadge(props.passwordResets),featured:props.passwordResets>0},
    ]},
    {id:'reports',title:'Reports',subtitle:'Operational visibility, analytics and backups.',items:[
      {href:'/admin/operations',label:'Operations & analytics',description:'Review trends, proof coverage, failures and handover metrics.',icon:<Gauge className="h-5 w-5"/>,badge:props.healthStatus&&props.healthStatus!=='HEALTHY'?{label:props.healthStatus,tone:'warn'}:{label:'Healthy',tone:'good'}},
      {href:'/api/admin/export?type=backup',label:'Fresh backup now',description:'Download a new operational backup immediately.',icon:<DatabaseBackup className="h-5 w-5"/>},
      {href:'/api/admin/backups/latest',label:'Latest auto backup',description:'Download the most recent scheduled snapshot.',icon:<DatabaseBackup className="h-5 w-5"/>},
    ]},
    {id:'system',title:'System',subtitle:'Configuration, scoring and operational controls.',items:[
      {href:'/admin/settings',label:'Settings & scoring',description:'Challenge dates, announcements and scoring rules.',icon:<Settings className="h-5 w-5"/>},
      {href:'/admin/maintenance',label:'Maintenance controls',description:'Pause participant submissions or lock competition changes.',icon:<Wrench className="h-5 w-5"/>,badge:{label:state.mode==='NORMAL'?'Normal':state.mode==='PAUSED'?'Paused':'Read-only',tone:state.mode==='NORMAL'?'good':'warn'},featured:state.mode!=='NORMAL'},
    ]},
  ];

  const attention=groups.flatMap(group=>group.items.filter(item=>item.featured).map(item=>({...item,group:group.title})));
  return <section aria-label="Admin workspace" className="space-y-5">
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-lime-300">Admin workspace</p><h2 className="mt-1 text-xl font-black">Everything grouped by job</h2><p className="mt-1 text-sm text-slate-500">Review first, then manage competition, participants, reports or system controls.</p></div><span className={`rounded-full border px-3 py-1.5 text-xs font-black ${attention.length?'border-amber-400/20 bg-amber-400/10 text-amber-200':'border-emerald-400/15 bg-emerald-400/[0.07] text-emerald-200'}`}>{attention.length?`${attention.length} need attention`:'All priority tools clear'}</span></div>
      <nav aria-label="Admin workspace sections" className="mt-4 flex gap-2 overflow-x-auto pb-1">{groups.map(group=><a key={group.id} href={`#admin-${group.id}`} className="shrink-0 rounded-xl border border-white/10 bg-black/10 px-3 py-2 text-xs font-black text-slate-300 hover:border-lime-300/30">{group.title}</a>)}</nav>
    </div>
    {attention.length?<section className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] p-4 sm:p-5"><div className="flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-amber-300"/><h3 className="font-black text-amber-100">Priority actions</h3><span className="ml-auto rounded-full bg-amber-300/10 px-2.5 py-1 text-xs font-black text-amber-200">{attention.length}</span></div><div className="mt-3 grid gap-2 sm:grid-cols-2">{attention.map(item=><ActionLink key={`${item.group}-${item.href}`} item={item} compact/>)}</div></section>:null}
    <div className="space-y-5">{groups.map(group=><section key={group.id} id={`admin-${group.id}`} className="scroll-mt-24 rounded-2xl border border-white/10 bg-white/[0.035] p-4 sm:p-5"><div className="mb-4"><h3 className="text-lg font-black">{group.title}</h3><p className="mt-1 text-sm text-slate-500">{group.subtitle}</p></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{group.items.map(item=><ActionLink key={item.href} item={item}/>)}</div></section>)}</div>
  </section>;
}

function ActionLink({item,compact=false}:{item:ActionItem;compact?:boolean}){
  const className=`group rounded-xl border p-4 transition ${item.featured?'border-amber-400/20 bg-amber-400/[0.07] hover:border-amber-300/40':'border-white/10 bg-black/10 hover:border-lime-300/30 hover:bg-white/[0.04]'}`;
  const body=<><div className="flex items-start gap-3"><span className={item.featured?'text-amber-300':'text-lime-300'}>{item.icon}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-black">{item.label}</p>{item.badge?<BadgePill badge={item.badge}/>:null}</div>{!compact?<p className="mt-1 text-xs leading-5 text-slate-500">{item.description}</p>:null}</div><span className="text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-slate-300">→</span></div></>;
  return item.href.startsWith('/api/')?<a href={item.href} className={className}>{body}</a>:<Link href={item.href} className={className}>{body}</Link>;
}
function BadgePill({badge}:{badge:Badge}){const tone=badge.tone??'neutral';const style=tone==='good'?'border-emerald-400/15 bg-emerald-400/[0.08] text-emerald-200':tone==='warn'?'border-amber-400/20 bg-amber-400/[0.09] text-amber-200':tone==='danger'?'border-rose-400/20 bg-rose-400/[0.09] text-rose-200':'border-white/10 bg-white/[0.04] text-slate-400';return <span className={`rounded-full border px-2 py-0.5 text-[0.65rem] font-black ${style}`}>{badge.label}</span>;}
