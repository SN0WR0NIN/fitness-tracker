import { redirect } from 'next/navigation';
import { Activity, CheckCircle2, DatabaseBackup, FileClock, Link2, ShieldCheck, TriangleAlert, Trophy, Users } from 'lucide-react';
import AdminActionHub from '@/components/AdminActionHub';
import AdminQueueBoard from '@/components/AdminQueueBoard';
import CompetitionHealthPanel from '@/components/CompetitionHealthPanel';
import Navbar from '@/components/Navbar';
import SystemStatusCard from '@/components/SystemStatusCard';
import { requireAdmin } from '@/lib/adminGuard';
import { getAuditEntries } from '@/lib/admin-control';
import { getCompetitionHealth } from '@/lib/competition-health';
import { getLatestCompletedWeekNumber, getWeeklyCompetitionResult } from '@/lib/competition-results';
import { getActivePasswordResetCount } from '@/lib/password-reset';
import { prisma } from '@/lib/prisma';
import { getLatestOperationalBackupSummary, getLatestScheduledHealth } from '@/lib/system-automation';

export const dynamic='force-dynamic';
type QueueCounts={corrections:number;dirty:number};
type PendingPreview={id:string;category:string;points:number;createdAt:Date;user:{name:string};column:{name:string}};

export default async function AdminPage(){
  const guard=await requireAdmin();if(guard.status===401)redirect('/auth/login');if(guard.error)redirect('/dashboard');
  const [users,activities,pending,approvedPoints,audit,stravaConnected,scheduledHealth,automatedBackup,passwordResets,latestCompletedWeek,queueCountsResult,pendingPreviewResult,competitionHealth]=await Promise.all([
    prisma.user.count(),
    prisma.activity.count(),
    prisma.activity.count({where:{status:'PENDING'}}),
    prisma.activity.aggregate({where:{status:'APPROVED'},_sum:{points:true}}),
    getAuditEntries(100),
    prisma.user.count({where:{stravaAthleteId:{not:null}}}),
    getLatestScheduledHealth(),
    getLatestOperationalBackupSummary(),
    getActivePasswordResetCount(),
    getLatestCompletedWeekNumber(),
    prisma.$queryRaw<Array<QueueCounts>>`SELECT (SELECT count(*)::int FROM app_internal.activity_correction WHERE status='OPEN') AS corrections,(SELECT count(*)::int FROM app_internal.weekly_result_dirty) AS dirty`,
    prisma.activity.findMany({where:{status:'PENDING'},orderBy:{createdAt:'asc'},take:5,select:{id:true,category:true,points:true,createdAt:true,user:{select:{name:true}},column:{select:{name:true}}}}),
    getCompetitionHealth(),
  ]);
  let latestWeeklyResult:Awaited<ReturnType<typeof getWeeklyCompetitionResult>>=null;let latestWeekPendingReviews=0;let latestWeekApprovedActivities=0;
  if(latestCompletedWeek>0)[latestWeeklyResult,latestWeekPendingReviews,latestWeekApprovedActivities]=await Promise.all([
    getWeeklyCompetitionResult(latestCompletedWeek),
    prisma.activity.count({where:{weekNumber:latestCompletedWeek,status:'PENDING'}}),
    prisma.activity.count({where:{weekNumber:latestCompletedWeek,status:'APPROVED'}}),
  ]);
  const weeklyAwardState=latestCompletedWeek<1||latestWeekApprovedActivities===0?'NOT_STARTED' as const:latestWeeklyResult?'FINALIZED' as const:latestWeekPendingReviews>0?'WAITING_REVIEW' as const:'READY' as const;
  const integrity=scheduledHealth?.details;
  const recentAudit=audit.slice(0,10);
  const checkTime=scheduledHealth?.createdAt;
  const openDuplicatePairs=integrity?.open_duplicate_pairs??integrity?.possible_duplicate_pairs??0;
  const deferredDuplicatePairs=integrity?.deferred_duplicate_pairs??0;
  const queueCounts=(queueCountsResult as QueueCounts[])[0]??{corrections:0,dirty:0};
  const pendingPreview=(pendingPreviewResult as PendingPreview[]).map(item=>({id:item.id,name:item.user.name,column:item.column.name,category:item.category,points:item.points,createdAt:item.createdAt}));
  const attentionAreas=[pending>0,competitionHealth.flaggedPending>0,queueCounts.corrections>0,openDuplicatePairs>0,queueCounts.dirty>0,passwordResets>0,competitionHealth.completedWeeks>competitionHealth.finalizedWeeks].filter(Boolean).length;

  return <div className="min-h-screen bg-slate-950 text-white"><Navbar/><main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
    <header className="overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(163,230,53,0.13),transparent_35%),rgba(255,255,255,0.04)] p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-lime-300"><ShieldCheck className="h-4 w-4"/>Admin command centre</p><h1 className="mt-3 text-3xl font-black sm:text-5xl">Run the challenge from one place</h1><p className="mt-3 max-w-2xl text-slate-400">Priority work first, then the tools are grouped by Review, Competition, Participants, Reports and System.</p></div><div className="flex flex-wrap gap-2"><span className="rounded-full border border-cyan-400/15 bg-cyan-400/[0.07] px-3 py-1.5 text-xs font-black text-cyan-200">Week {competitionHealth.currentWeek}</span><span className={`rounded-full border px-3 py-1.5 text-xs font-black ${attentionAreas?'border-amber-400/20 bg-amber-400/10 text-amber-200':'border-emerald-400/15 bg-emerald-400/[0.07] text-emerald-200'}`}>{attentionAreas?`${attentionAreas} attention area${attentionAreas===1?'':'s'}`:'No priority alerts'}</span></div></div>
    </header>

    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Stat icon={<Users className="h-5 w-5"/>} label="Participants" value={users.toString()} detail={`${stravaConnected} Strava connected`}/><Stat icon={<Activity className="h-5 w-5"/>} label="Activities" value={activities.toString()} detail="All challenge entries"/><Stat icon={<FileClock className="h-5 w-5"/>} label="Pending review" value={pending.toString()} detail={competitionHealth.flaggedPending?`${competitionHealth.flaggedPending} flagged for attention`:'No automated flags'}/><Stat icon={<Trophy className="h-5 w-5"/>} label="Approved points" value={(approvedPoints._sum.points??0).toFixed(1)} detail="Current approved total"/></section>

    <AdminQueueBoard pendingCount={pending} correctionCount={queueCounts.corrections} duplicateCount={openDuplicatePairs} dirtyWeekCount={queueCounts.dirty} pendingItems={pendingPreview}/>

    <AdminActionHub pendingReviews={pending} flaggedReviews={competitionHealth.flaggedPending} correctionCount={queueCounts.corrections} duplicateReviews={openDuplicatePairs} dirtyWeekCount={queueCounts.dirty} passwordResets={passwordResets} latestCompletedWeek={latestCompletedWeek} latestWeekPendingReviews={latestWeekPendingReviews} weeklyAwardState={weeklyAwardState} healthStatus={scheduledHealth?.status??null} finalizedWeeks={competitionHealth.finalizedWeeks} completedWeeks={competitionHealth.completedWeeks}/>

    <CompetitionHealthPanel health={competitionHealth}/>

    <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:p-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Audit trail</p><h2 className="mt-1 text-lg font-black">Recent admin activity</h2><p className="mt-1 text-sm text-slate-500">The latest operational changes made through the system.</p></div><span className="text-xs text-slate-600">Showing latest {recentAudit.length}</span></div><div className="mt-5 divide-y divide-white/5">{recentAudit.length?recentAudit.map(item=><div key={item.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-bold">{item.action}</p><p className="mt-1 text-xs text-slate-500">{item.actorName} · {item.target}</p></div><time className="text-xs text-slate-600">{item.createdAt.toLocaleString('en-SG',{timeZone:'Asia/Singapore',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</time></div>):<p className="py-8 text-center text-sm text-slate-500">No admin audit entries yet.</p>}</div></section>

    <div id="system-health" className="scroll-mt-6"><SystemStatusCard/></div>

    <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:p-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Automation</p><h2 className="mt-1 text-lg font-black">Safety net</h2><p className="mt-1 text-sm text-slate-500">Integrity runs hourly. Private operational snapshots run daily at 2:30 AM Singapore time.</p></div><span className="text-xs text-slate-600">{checkTime?`Last check ${formatSg(checkTime)}`:'No scheduled check recorded'}</span></div><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><HealthStat icon={(integrity?.score_mismatches??1)===0?<CheckCircle2 className="h-5 w-5"/>:<TriangleAlert className="h-5 w-5"/>} label="Score reconciliation" value={integrity?(integrity.score_mismatches===0?'Balanced':`${integrity.score_mismatches} mismatch${integrity.score_mismatches===1?'':'es'}`):'No result'} detail={scheduledHealth?`Scheduled status: ${scheduledHealth.status}`:'Waiting for scheduler'} good={Boolean(integrity&&integrity.score_mismatches===0)}/><HealthStat icon={(integrity?.possible_duplicate_pairs??1)===0?<CheckCircle2 className="h-5 w-5"/>:<TriangleAlert className="h-5 w-5"/>} label="Duplicate review" value={integrity?`${openDuplicatePairs} open`:'No result'} detail={`${deferredDuplicatePairs} deferred · decisions are tracked`} good={Boolean(integrity&&integrity.possible_duplicate_pairs===0)}/><HealthStat icon={<Link2 className="h-5 w-5"/>} label="Strava connected" value={`${stravaConnected} / ${users}`} detail="Participant accounts" good/><HealthStat icon={<DatabaseBackup className="h-5 w-5"/>} label="Automated backup" value={automatedBackup?automatedBackup.createdAt.toLocaleDateString('en-SG',{timeZone:'Asia/Singapore',day:'numeric',month:'short'}):'Not recorded'} detail={automatedBackup?`${automatedBackup.counts.activities??0} activities · checksum ${automatedBackup.checksumSha256.slice(0,8)}…`:'Waiting for first snapshot'} good={Boolean(automatedBackup)}/></div></section>
  </main></div>;
}

function formatSg(value:Date){return value.toLocaleString('en-SG',{timeZone:'Asia/Singapore',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});}
function Stat({icon,label,value,detail}:{icon:React.ReactNode;label:string;value:string;detail:string}){return <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-5"><span className="text-lime-300">{icon}</span><p className="mt-4 text-[0.65rem] font-black uppercase tracking-wider text-slate-500">{label}</p><p className="mt-1 text-2xl font-black sm:text-3xl">{value}</p><p className="mt-1 text-xs text-slate-600">{detail}</p></div>;}
function HealthStat({icon,label,value,detail,good}:{icon:React.ReactNode;label:string;value:string;detail:string;good:boolean}){return <div className={`rounded-xl border p-4 ${good?'border-emerald-400/15 bg-emerald-400/[0.06]':'border-amber-400/20 bg-amber-400/[0.07]'}`}><span className={good?'text-emerald-300':'text-amber-300'}>{icon}</span><p className="mt-3 text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p><p className="mt-1 text-lg font-black">{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div>;}
