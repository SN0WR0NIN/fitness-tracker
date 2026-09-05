import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Award, CalendarClock, Trophy } from 'lucide-react';
import Navbar from '@/components/Navbar';
import WeeklyAwardsAdminControls from '@/components/WeeklyAwardsAdminControls';
import { requireAdmin } from '@/lib/adminGuard';
import { getLatestCompletedWeekNumber, getWeeklyCompetitionResults } from '@/lib/competition-results';

export const dynamic = 'force-dynamic';

export default async function AdminAwardsPage() {
  const guard = await requireAdmin();
  if (guard.status === 401) redirect('/auth/login');
  if (guard.error) redirect('/dashboard');

  const [results, completedWeek] = await Promise.all([
    getWeeklyCompetitionResults(30),
    getLatestCompletedWeekNumber(),
  ]);
  const finalizedWeeks = results.map((result) => result.weekNumber);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Navbar />
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:py-12">
        <Link href="/admin" className="text-sm font-bold text-lime-300">← Command Centre</Link>
        <header className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 sm:p-8">
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-lime-300"><Award className="h-4 w-4" />Competition automation</p>
          <h1 className="mt-3 text-3xl font-black sm:text-4xl">Weekly Awards</h1>
          <p className="mt-2 text-sm text-slate-400">Completed weeks finalize automatically after pending reviews are cleared. The scheduler retries hourly until the week is ready.</p>
        </header>

        <section className="grid gap-4 sm:grid-cols-3">
          <Metric icon={<CalendarClock className="h-5 w-5" />} label="Completed weeks" value={completedWeek.toString()} />
          <Metric icon={<Trophy className="h-5 w-5" />} label="Finalized results" value={results.length.toString()} />
          <Metric icon={<Award className="h-5 w-5" />} label="Latest finalized" value={results[0] ? `Week ${results[0].weekNumber}` : 'None'} />
        </section>

        <WeeklyAwardsAdminControls completedWeek={completedWeek} finalizedWeeks={finalizedWeeks} />

        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-black">Finalized history</h2><p className="mt-1 text-sm text-slate-500">These are the snapshots participants see on Results.</p></div><Link href="/results" className="rounded-xl border border-white/10 px-4 py-2 text-sm font-bold text-lime-300">Open public results</Link></div>
          <div className="mt-4 divide-y divide-white/5">{results.length ? results.map((result) => <div key={`${result.seasonKey}-${result.weekNumber}`} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p className="font-black">Week {result.weekNumber}</p><p className="mt-1 text-xs text-slate-500">{result.activityCount} activities · {result.activeAthletes} athletes · {result.awards.length} awards</p></div><div className="text-right"><p className="font-black text-lime-300">{result.totalPoints.toFixed(1)} pts</p><p className="text-[0.65rem] text-slate-600">Updated {result.updatedAt.toLocaleString('en-SG', { timeZone: 'Asia/Singapore', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p></div></div>) : <p className="py-8 text-center text-sm text-slate-500">No finalized results yet.</p>}</div>
        </section>
      </main>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"><span className="text-lime-300">{icon}</span><p className="mt-4 text-xs font-black uppercase tracking-wider text-slate-500">{label}</p><p className="mt-2 text-2xl font-black">{value}</p></div>;
}
