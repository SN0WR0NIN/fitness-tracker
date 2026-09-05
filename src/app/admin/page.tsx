import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Activity, ArrowRight, CheckCircle2, Clock3, DatabaseBackup, FileClock, Megaphone, Settings, ShieldCheck, Trophy, Users } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { requireAdmin } from '@/lib/adminGuard';
import { getAuditEntries, getChallengeSettings } from '@/lib/admin-control';
import { prisma } from '@/lib/prisma';
import { getWeekStart } from '@/lib/scoring';

export const dynamic = 'force-dynamic';

function singaporeDayStart(now: Date) {
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Singapore', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  return new Date(`${date}T00:00:00+08:00`);
}

export default async function AdminPage() {
  const guard = await requireAdmin();
  if (guard.status === 401) redirect('/auth/login');
  if (guard.error) redirect('/dashboard');

  const now = new Date();
  const todayStart = singaporeDayStart(now);
  const localDay = new Date(now.getTime() + 8 * 3600000).getUTCDay();
  const submissionWeekStart = new Date(todayStart.getTime() - localDay * 86400000);
  const scoreWeekStart = getWeekStart(now);
  const inactiveCutoff = new Date(now.getTime() - 7 * 86400000);

  const [
    participants,
    activities,
    pending,
    rejected,
    activitiesToday,
    approvedToday,
    weeklyActivityRows,
    inactiveUsers,
    neverSubmitted,
    oldestPending,
    audit,
    settings,
    weeklyScoreRows,
  ] = await Promise.all([
    prisma.user.count({ where: { role: 'MEMBER' } }),
    prisma.activity.count(),
    prisma.activity.count({ where: { status: 'PENDING' } }),
    prisma.activity.count({ where: { status: 'REJECTED' } }),
    prisma.activity.findMany({ where: { createdAt: { gte: todayStart } }, select: { userId: true } }),
    prisma.activity.findMany({ where: { status: 'APPROVED', reviewedAt: { gte: todayStart } }, select: { userId: true, points: true } }),
    prisma.activity.findMany({ where: { createdAt: { gte: submissionWeekStart } }, select: { userId: true, column: { select: { name: true } } } }),
    prisma.user.findMany({ where: { role: 'MEMBER', activities: { none: { createdAt: { gte: inactiveCutoff } } } }, select: { id: true, name: true, column: { select: { name: true } } }, orderBy: { name: 'asc' } }),
    prisma.user.count({ where: { role: 'MEMBER', activities: { none: {} } } }),
    prisma.activity.findFirst({ where: { status: 'PENDING' }, orderBy: { createdAt: 'asc' }, select: { id: true, createdAt: true, user: { select: { name: true } } } }),
    getAuditEntries(10),
    getChallengeSettings(),
    prisma.weeklyScore.findMany({ where: { weekStart: { gte: scoreWeekStart } }, select: { userId: true, totalPoints: true } }),
  ]);

  const activeToday = new Set(activitiesToday.map((row) => row.userId)).size;
  const pointsToday = approvedToday.reduce((sum, row) => sum + row.points, 0);
  const activeThisWeek = new Set(weeklyActivityRows.map((row) => row.userId)).size;
  const columnCounts = new Map<string, number>();
  for (const row of weeklyActivityRows) {
    const name = row.column.name;
    columnCounts.set(name, (columnCounts.get(name) ?? 0) + 1);
  }
  const topColumn = [...columnCounts.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
  const weeklyPoints = new Map<string, number>();
  for (const row of weeklyScoreRows) weeklyPoints.set(row.userId, (weeklyPoints.get(row.userId) ?? 0) + row.totalPoints);
  const goalHitters = [...weeklyPoints.values()].filter((points) => points >= settings.weeklyGoal).length;
  const goalRate = participants ? Math.round(goalHitters / participants * 100) : 0;
  const oldestPendingHours = oldestPending ? Math.max(0, Math.floor((now.getTime() - oldestPending.createdAt.getTime()) / 3600000)) : 0;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Navbar />
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <header className="overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(163,230,53,0.14),_transparent_36%),radial-gradient(circle_at_85%_20%,_rgba(14,165,233,0.15),_transparent_32%),rgba(255,255,255,0.04)] p-6 sm:p-8">
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.22em] text-lime-300"><ShieldCheck className="h-4 w-4" />Admin operations</p>
          <div className="mt-3 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div><h1 className="text-3xl font-black sm:text-5xl">Command Centre 2.0</h1><p className="mt-3 max-w-2xl text-slate-400">See what needs attention first, what happened today, and how participation is moving this week.</p></div>
            <div className="flex flex-wrap gap-2"><ActionLink href="/admin/activities" label="Review pending" /><ActionLink href="/admin/users" label="Manage users" /><ActionLink href="/admin/settings" label="Challenge settings" /></div>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric icon={<FileClock />} label="Pending review" value={pending.toString()} detail={oldestPending ? `Oldest waiting ${oldestPendingHours}h` : 'Queue clear'} tone="text-orange-300" />
          <Metric icon={<Users />} label="Active this week" value={`${activeThisWeek}/${participants}`} detail={`${weeklyActivityRows.length} submissions`} tone="text-sky-300" />
          <Metric icon={<CheckCircle2 />} label="Weekly goal reached" value={`${goalRate}%`} detail={`${goalHitters} participants`} tone="text-emerald-300" />
          <Metric icon={<Trophy />} label="Most active column" value={topColumn?.[0] ?? '—'} detail={topColumn ? `${topColumn[1]} submissions this week` : 'No submissions yet'} tone="text-yellow-300" />
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
            <Heading icon={<FileClock className="h-5 w-5 text-orange-300" />} title="Needs attention" subtitle="Operational items worth checking now" />
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Attention label="Pending submissions" value={pending.toString()} detail={oldestPending ? `${oldestPending.user.name}'s submission is the oldest · ${oldestPendingHours}h` : 'Nothing waiting for review'} href="/admin/activities" />
              <Attention label="Rejected activities" value={rejected.toString()} detail="Review patterns or recurring issues" href="/admin/activities?status=REJECTED" />
              <Attention label="Inactive 7+ days" value={inactiveUsers.length.toString()} detail="Participants with no recent submission" href="/admin/users" />
              <Attention label="Never submitted" value={neverSubmitted.toString()} detail="Registered participants still at zero activity" href="/admin/users" />
            </div>
            {inactiveUsers.length ? <div className="mt-5 border-t border-white/10 pt-4"><p className="text-xs font-black uppercase tracking-wider text-slate-500">Inactive participant sample</p><div className="mt-3 flex flex-wrap gap-2">{inactiveUsers.slice(0, 6).map((user) => <span key={user.id} className="rounded-full border border-white/10 bg-black/10 px-3 py-1.5 text-xs text-slate-300">{user.name}{user.column ? ` · ${user.column.name}` : ''}</span>)}</div></div> : null}
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
            <Heading icon={<Activity className="h-5 w-5 text-sky-300" />} title="Today" subtitle="Singapore time · live operational pulse" />
            <div className="mt-5 grid grid-cols-2 gap-3"><MiniMetric label="Submitted" value={activitiesToday.length.toString()} /><MiniMetric label="Approved" value={approvedToday.length.toString()} /><MiniMetric label="Points awarded" value={pointsToday.toFixed(1)} /><MiniMetric label="Active athletes" value={activeToday.toString()} /></div>
            <div className="mt-5 rounded-xl border border-white/5 bg-black/10 p-4"><p className="text-xs text-slate-500">Challenge totals</p><p className="mt-2 text-sm font-bold text-slate-200">{participants} participants · {activities} activities recorded</p></div>
          </section>
        </div>

        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
          <Heading icon={<ShieldCheck className="h-5 w-5 text-violet-300" />} title="Quick actions" subtitle="Common admin tasks without hunting through menus" />
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><Quick href="/admin/activities" icon={<FileClock />} label="Review queue" detail={`${pending} pending`} /><Quick href="/admin/users" icon={<Users />} label="Manage users" detail={`${participants} participants`} /><Quick href="/admin/settings" icon={<Settings />} label="Settings & scoring" detail="Rules, columns, notices" /><Quick href="/admin/recap" icon={<Megaphone />} label="Weekly recap" detail="Prepare challenge update" /><Quick href="/api/admin/export?type=backup" icon={<DatabaseBackup />} label="Export backup" detail="Operational JSON backup" /></div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
          <Heading icon={<Clock3 className="h-5 w-5 text-slate-300" />} title="Admin activity feed" subtitle="Recent operational changes from the existing audit trail" />
          <div className="mt-5 divide-y divide-white/5">{audit.length ? audit.map((item) => <div key={item.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-bold text-slate-200">{item.action}</p><p className="mt-1 text-xs text-slate-500">{item.actorName} · {item.target}</p></div><time className="text-xs text-slate-600">{item.createdAt.toLocaleString('en-SG', { timeZone: 'Asia/Singapore', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</time></div>) : <p className="py-8 text-center text-sm text-slate-500">No admin audit entries yet.</p>}</div>
        </section>
      </main>
    </div>
  );
}

function Heading({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) { return <div className="flex items-start gap-3"><span className="rounded-xl bg-white/5 p-2.5">{icon}</span><div><h2 className="text-lg font-black">{title}</h2><p className="mt-1 text-sm text-slate-500">{subtitle}</p></div></div>; }
function Metric({ icon, label, value, detail, tone }: { icon: React.ReactNode; label: string; value: string; detail: string; tone: string }) { return <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"><span className={tone}>{icon}</span><p className="mt-5 text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p><p className="mt-2 truncate text-3xl font-black">{value}</p><p className="mt-2 text-xs text-slate-500">{detail}</p></div>; }
function MiniMetric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-white/5 bg-black/10 p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-2xl font-black">{value}</p></div>; }
function Attention({ label, value, detail, href }: { label: string; value: string; detail: string; href: string }) { return <Link href={href} className="group rounded-xl border border-white/5 bg-black/10 p-4 transition hover:border-orange-300/20 hover:bg-orange-300/5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-2xl font-black">{value}</p><p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p></div><ArrowRight className="h-4 w-4 text-slate-600 transition group-hover:translate-x-1 group-hover:text-orange-300" /></div></Link>; }
function Quick({ href, icon, label, detail }: { href: string; icon: React.ReactNode; label: string; detail: string }) { return <Link href={href} className="rounded-xl border border-white/10 bg-black/10 p-4 transition hover:border-lime-300/20 hover:bg-lime-300/5"><span className="text-lime-300">{icon}</span><p className="mt-4 text-sm font-black">{label}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></Link>; }
function ActionLink({ href, label }: { href: string; label: string }) { return <Link href={href} className="rounded-xl border border-white/10 bg-black/10 px-4 py-2.5 text-sm font-bold transition hover:border-lime-300/30 hover:text-lime-300">{label}</Link>; }
