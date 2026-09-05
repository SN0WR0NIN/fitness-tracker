import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Activity, ArrowRight, CheckCircle2, Clock3, DatabaseBackup, FileClock, Megaphone, Settings, ShieldCheck, Users } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { requireAdmin } from '@/lib/adminGuard';
import { getAuditEntries } from '@/lib/admin-control';
import { prisma } from '@/lib/prisma';

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

  const [participants, activities, pending, rejected, todayRows, approvedTodayRows, oldestPending, audit] = await Promise.all([
    prisma.user.count({ where: { role: 'MEMBER' } }),
    prisma.activity.count(),
    prisma.activity.count({ where: { status: 'PENDING' } }),
    prisma.activity.count({ where: { status: 'REJECTED' } }),
    prisma.activity.findMany({ where: { createdAt: { gte: todayStart } }, select: { userId: true } }),
    prisma.activity.findMany({ where: { status: 'APPROVED', reviewedAt: { gte: todayStart } }, select: { userId: true, points: true } }),
    prisma.activity.findFirst({ where: { status: 'PENDING' }, orderBy: { createdAt: 'asc' }, select: { createdAt: true, user: { select: { name: true } } } }),
    getAuditEntries(10),
  ]);

  const activeToday = new Set(todayRows.map((row) => row.userId)).size;
  const pointsToday = approvedTodayRows.reduce((sum, row) => sum + row.points, 0);
  const oldestPendingHours = oldestPending ? Math.max(0, Math.floor((now.getTime() - oldestPending.createdAt.getTime()) / 3600000)) : 0;

  return <div className="min-h-screen bg-slate-950 text-white"><Navbar /><main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
    <header className="rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(163,230,53,0.14),_transparent_38%),rgba(255,255,255,0.04)] p-6 sm:p-8"><p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-lime-300"><ShieldCheck className="h-4 w-4" />Admin operations</p><div className="mt-3 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><h1 className="text-3xl font-black sm:text-5xl">Command Centre 2.0</h1><p className="mt-3 max-w-2xl text-slate-400">Review the live operational picture first, then open configuration only when you need it.</p></div><div className="flex flex-wrap gap-2"><Action href="/admin/activities" label="Review pending" /><Action href="/admin/users" label="Manage users" /><Action href="/admin/settings" label="Challenge settings" /></div></div></header>

    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Metric icon={<FileClock />} label="Pending review" value={pending.toString()} detail={oldestPending ? `Oldest waiting ${oldestPendingHours}h` : 'Queue clear'} /><Metric icon={<Activity />} label="Submitted today" value={todayRows.length.toString()} detail={`${activeToday} active athletes`} /><Metric icon={<CheckCircle2 />} label="Approved today" value={approvedTodayRows.length.toString()} detail={`${pointsToday.toFixed(1)} points awarded`} /><Metric icon={<Users />} label="Participants" value={participants.toString()} detail={`${activities} total activities`} /></section>

    <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
      <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:p-6"><Heading icon={<FileClock className="h-5 w-5 text-orange-300" />} title="Needs attention" subtitle="Core review workload" /><div className="mt-5 grid gap-3 sm:grid-cols-2"><Attention label="Pending submissions" value={pending.toString()} detail={oldestPending ? `${oldestPending.user.name}'s submission is the oldest` : 'Nothing waiting for review'} href="/admin/activities" /><Attention label="Rejected activities" value={rejected.toString()} detail="Check recurring submission issues" href="/admin/activities?status=REJECTED" /></div></section>
      <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:p-6"><Heading icon={<Activity className="h-5 w-5 text-sky-300" />} title="Today" subtitle="Singapore time" /><div className="mt-5 grid grid-cols-2 gap-3"><Mini label="Submitted" value={todayRows.length.toString()} /><Mini label="Approved" value={approvedTodayRows.length.toString()} /><Mini label="Points" value={pointsToday.toFixed(1)} /><Mini label="Active athletes" value={activeToday.toString()} /></div></section>
    </div>

    <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:p-6"><Heading icon={<ShieldCheck className="h-5 w-5 text-violet-300" />} title="Quick actions" subtitle="Common admin tasks" /><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><Quick href="/admin/activities" icon={<FileClock />} label="Review queue" /><Quick href="/admin/users" icon={<Users />} label="Manage users" /><Quick href="/admin/settings" icon={<Settings />} label="Settings & scoring" /><Quick href="/admin/recap" icon={<Megaphone />} label="Weekly recap" /><Quick href="/api/admin/export?type=backup" icon={<DatabaseBackup />} label="Export backup" /></div></section>

    <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:p-6"><Heading icon={<Clock3 className="h-5 w-5 text-slate-300" />} title="Admin activity feed" subtitle="Recent changes from the existing audit trail" /><div className="mt-5 divide-y divide-white/5">{audit.length ? audit.map((item) => <div key={item.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-bold">{item.action}</p><p className="mt-1 text-xs text-slate-500">{item.actorName} · {item.target}</p></div><time className="text-xs text-slate-600">{item.createdAt.toLocaleString('en-SG', { timeZone: 'Asia/Singapore', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</time></div>) : <p className="py-8 text-center text-sm text-slate-500">No admin audit entries yet.</p>}</div></section>
  </main></div>;
}

function Heading({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) { return <div className="flex items-start gap-3"><span className="rounded-xl bg-white/5 p-2.5">{icon}</span><div><h2 className="text-lg font-black">{title}</h2><p className="mt-1 text-sm text-slate-500">{subtitle}</p></div></div>; }
function Metric({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) { return <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"><span className="text-lime-300">{icon}</span><p className="mt-5 text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p><p className="mt-2 text-3xl font-black">{value}</p><p className="mt-2 text-xs text-slate-500">{detail}</p></div>; }
function Mini({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-white/5 bg-black/10 p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-2xl font-black">{value}</p></div>; }
function Attention({ label, value, detail, href }: { label: string; value: string; detail: string; href: string }) { return <Link href={href} className="group rounded-xl border border-white/5 bg-black/10 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-2xl font-black">{value}</p><p className="mt-2 text-xs text-slate-500">{detail}</p></div><ArrowRight className="h-4 w-4 text-slate-600" /></div></Link>; }
function Quick({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) { return <Link href={href} className="rounded-xl border border-white/10 bg-black/10 p-4"><span className="text-lime-300">{icon}</span><p className="mt-4 text-sm font-black">{label}</p></Link>; }
function Action({ href, label }: { href: string; label: string }) { return <Link href={href} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-bold hover:text-lime-300">{label}</Link>; }
