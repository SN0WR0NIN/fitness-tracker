import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Activity, CheckCircle2, DatabaseBackup, FileClock, Link2, Megaphone, Settings, ShieldCheck, TriangleAlert, Trophy, Users } from 'lucide-react';
import Navbar from '@/components/Navbar';
import SystemStatusCard from '@/components/SystemStatusCard';
import { requireAdmin } from '@/lib/adminGuard';
import { getAuditEntries } from '@/lib/admin-control';
import { prisma } from '@/lib/prisma';
import { getLatestOperationalBackupSummary, getLatestScheduledHealth } from '@/lib/system-automation';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const guard = await requireAdmin();
  if (guard.status === 401) redirect('/auth/login');
  if (guard.error) redirect('/dashboard');

  const [users, activities, pending, approvedPoints, audit, stravaConnected, scheduledHealth, automatedBackup] = await Promise.all([
    prisma.user.count(),
    prisma.activity.count(),
    prisma.activity.count({ where: { status: 'PENDING' } }),
    prisma.activity.aggregate({ where: { status: 'APPROVED' }, _sum: { points: true } }),
    getAuditEntries(100),
    prisma.user.count({ where: { stravaAthleteId: { not: null } } }),
    getLatestScheduledHealth(),
    getLatestOperationalBackupSummary(),
  ]);

  const integrity = scheduledHealth?.details;
  const recentAudit = audit.slice(0, 10);
  const checkTime = scheduledHealth?.createdAt;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Navbar />
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <header className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 sm:p-8">
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-lime-300"><ShieldCheck className="h-4 w-4" />Admin operations</p>
          <div className="mt-3 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div><h1 className="text-3xl font-black sm:text-5xl">Command Centre 2.0</h1><p className="mt-3 text-slate-400">A faster operations-first landing page for the challenge.</p></div>
            <div className="flex flex-wrap gap-2"><AdminLink href="/admin/activities" label="Review queue" /><AdminLink href="/admin/users" label="Manage users" /><AdminLink href="/admin/settings" label="Settings" /></div>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat icon={<Users className="h-5 w-5" />} label="Participants" value={users.toString()} />
          <Stat icon={<Activity className="h-5 w-5" />} label="Activities" value={activities.toString()} />
          <Stat icon={<FileClock className="h-5 w-5" />} label="Pending review" value={pending.toString()} />
          <Stat icon={<Trophy className="h-5 w-5" />} label="Approved points" value={(approvedPoints._sum.points ?? 0).toFixed(1)} />
        </section>

        <SystemStatusCard />

        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div><h2 className="text-lg font-black">Automated safety net</h2><p className="mt-1 text-sm text-slate-500">Integrity runs hourly. Private operational snapshots run daily at 2:30 AM Singapore time.</p></div>
            <span className="text-xs text-slate-600">{checkTime ? `Last check ${formatSg(checkTime)}` : 'No scheduled check recorded'}</span>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <HealthStat
              icon={(integrity?.score_mismatches ?? 1) === 0 ? <CheckCircle2 className="h-5 w-5" /> : <TriangleAlert className="h-5 w-5" />}
              label="Score reconciliation"
              value={integrity ? (integrity.score_mismatches === 0 ? 'Balanced' : `${integrity.score_mismatches} mismatch${integrity.score_mismatches === 1 ? '' : 'es'}`) : 'No result'}
              detail={scheduledHealth ? `Scheduled status: ${scheduledHealth.status}` : 'Waiting for scheduler'}
              good={Boolean(integrity && integrity.score_mismatches === 0)}
            />
            <HealthStat
              icon={(integrity?.possible_duplicate_pairs ?? 1) === 0 ? <CheckCircle2 className="h-5 w-5" /> : <TriangleAlert className="h-5 w-5" />}
              label="Duplicate review"
              value={integrity ? `${integrity.possible_duplicate_pairs} warning${integrity.possible_duplicate_pairs === 1 ? '' : 's'}` : 'No result'}
              detail="Similar same-day distance pairs · review only"
              good={Boolean(integrity && integrity.possible_duplicate_pairs === 0)}
            />
            <HealthStat icon={<Link2 className="h-5 w-5" />} label="Strava connected" value={`${stravaConnected} / ${users}`} detail="Participant accounts" good />
            <HealthStat
              icon={<DatabaseBackup className="h-5 w-5" />}
              label="Automated backup"
              value={automatedBackup ? automatedBackup.createdAt.toLocaleDateString('en-SG', { timeZone: 'Asia/Singapore', day: 'numeric', month: 'short' }) : 'Not recorded'}
              detail={automatedBackup ? `${automatedBackup.counts.activities ?? 0} activities · checksum ${automatedBackup.checksumSha256.slice(0, 8)}…` : 'Waiting for first snapshot'}
              good={Boolean(automatedBackup)}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
          <h2 className="text-lg font-black">Quick actions</h2>
          <p className="mt-1 text-sm text-slate-500">Jump directly to the most common admin tasks.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <Quick href="/admin/activities" icon={<FileClock className="h-5 w-5" />} label="Review pending" />
            <Quick href="/admin/users" icon={<Users className="h-5 w-5" />} label="Manage users" />
            <Quick href="/admin/settings" icon={<Settings className="h-5 w-5" />} label="Settings & scoring" />
            <Quick href="/admin/recap" icon={<Megaphone className="h-5 w-5" />} label="Weekly recap" />
            <Quick href="/api/admin/export?type=backup" icon={<DatabaseBackup className="h-5 w-5" />} label="Fresh backup now" />
            <Quick href="/api/admin/backups/latest" icon={<DatabaseBackup className="h-5 w-5" />} label="Download auto backup" />
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
          <h2 className="text-lg font-black">Admin activity feed</h2>
          <p className="mt-1 text-sm text-slate-500">Recent operational changes from the existing audit trail.</p>
          <div className="mt-5 divide-y divide-white/5">
            {recentAudit.length ? recentAudit.map((item) => (
              <div key={item.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div><p className="text-sm font-bold">{item.action}</p><p className="mt-1 text-xs text-slate-500">{item.actorName} · {item.target}</p></div>
                <time className="text-xs text-slate-600">{item.createdAt.toLocaleString('en-SG', { timeZone: 'Asia/Singapore', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</time>
              </div>
            )) : <p className="py-8 text-center text-sm text-slate-500">No admin audit entries yet.</p>}
          </div>
        </section>
      </main>
    </div>
  );
}

function formatSg(value: Date) {
  return value.toLocaleString('en-SG', { timeZone: 'Asia/Singapore', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"><span className="text-lime-300">{icon}</span><p className="mt-5 text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p><p className="mt-2 text-3xl font-black">{value}</p></div>;
}
function HealthStat({ icon, label, value, detail, good }: { icon: React.ReactNode; label: string; value: string; detail: string; good: boolean }) {
  return <div className={`rounded-xl border p-4 ${good ? 'border-emerald-400/15 bg-emerald-400/[0.06]' : 'border-amber-400/20 bg-amber-400/[0.07]'}`}><span className={good ? 'text-emerald-300' : 'text-amber-300'}>{icon}</span><p className="mt-3 text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p><p className="mt-1 text-lg font-black">{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div>;
}
function Quick({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return <Link href={href} className="rounded-xl border border-white/10 bg-black/10 p-4 transition hover:border-lime-300/30"><span className="text-lime-300">{icon}</span><p className="mt-4 text-sm font-black">{label}</p></Link>;
}
function AdminLink({ href, label }: { href: string; label: string }) {
  return <Link href={href} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-bold transition hover:text-lime-300">{label}</Link>;
}
