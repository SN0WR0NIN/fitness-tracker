import Link from 'next/link';
import { Award, CalendarDays, Flame, Medal, Trophy, Users } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { getWeeklyCompetitionResults, type WeeklyAward } from '@/lib/competition-results';

export const dynamic = 'force-dynamic';

export default async function ResultsPage() {
  const results = await getWeeklyCompetitionResults();
  const latest = results[0] ?? null;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Navbar />
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <header className="overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(163,230,53,0.18),_transparent_42%),rgba(255,255,255,0.04)] p-6 sm:p-8">
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-lime-300"><Trophy className="h-4 w-4" />Competition history</p>
          <h1 className="mt-3 text-3xl font-black sm:text-5xl">Weekly Results & Awards</h1>
          <p className="mt-3 max-w-3xl text-slate-400">Finalized weekly standings stay here permanently. Results are created only after the week closes and pending reviews are cleared.</p>
        </header>

        {!latest ? (
          <section className="rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-16 text-center">
            <CalendarDays className="mx-auto h-10 w-10 text-slate-600" />
            <h2 className="mt-4 text-xl font-black">No finalized week yet</h2>
            <p className="mt-2 text-sm text-slate-500">The first completed week will appear here automatically.</p>
          </section>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-3">
              <Metric icon={<Medal className="h-5 w-5" />} label={`Week ${latest.weekNumber}`} value={`${latest.totalPoints.toFixed(1)} pts`} detail={`${formatDate(latest.displayStartDate)} – ${formatDate(latest.displayEndDate)}`} />
              <Metric icon={<Flame className="h-5 w-5" />} label="Approved activities" value={latest.activityCount.toString()} detail="Included in the finalized week" />
              <Metric icon={<Users className="h-5 w-5" />} label="Active athletes" value={latest.activeAthletes.toString()} detail="Participants with approved activity" />
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
              <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-black">Week {latest.weekNumber} awards</h2><p className="mt-1 text-sm text-slate-500">{latest.challengeName} · finalized {formatDateTime(latest.generatedAt)}</p></div></div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {latest.awards.map((award) => <AwardCard key={`${award.type}-${award.entityId}`} award={award} />)}
              </div>
            </section>
          </>
        )}

        <section className="space-y-4">
          {results.map((result) => (
            <details key={`${result.seasonKey}-${result.weekNumber}`} className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]" open={result === latest}>
              <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-6">
                <div><p className="text-lg font-black">Week {result.weekNumber}</p><p className="mt-1 text-xs text-slate-500">{formatDate(result.displayStartDate)} – {formatDate(result.displayEndDate)} · {result.activityCount} activities · {result.totalPoints.toFixed(1)} pts</p></div>
                <span className="text-xs font-bold text-lime-300 group-open:hidden">View standings</span>
              </summary>
              <div className="grid gap-5 border-t border-white/5 p-5 sm:p-6 lg:grid-cols-2">
                <Standings title="Column standings" rows={result.columnStandings.slice(0, 10).map((row) => ({ id: row.columnId, name: row.name, rank: row.rank, points: row.points, detail: `${row.activeAthletes} active athletes` }))} />
                <Standings title="Athlete standings" rows={result.athleteStandings.slice(0, 10).map((row) => ({ id: row.userId, name: row.name, rank: row.rank, points: row.points, detail: `${row.activityCount} activities` }))} athlete />
                <div className="lg:col-span-2"><h3 className="text-sm font-black uppercase tracking-wider text-slate-500">Awards</h3><div className="mt-3 flex flex-wrap gap-2">{result.awards.map((award) => <span key={`${result.weekNumber}-${award.type}-${award.entityId}`} className="rounded-full border border-white/10 bg-black/20 px-3 py-2 text-xs"><span className="mr-1">{award.emoji}</span>{award.label}: <strong>{award.entityName}</strong> · {award.displayValue}</span>)}</div></div>
              </div>
            </details>
          ))}
        </section>

        <div className="pb-16 text-center"><Link href="/leaderboard" className="inline-flex rounded-xl border border-lime-300/25 px-5 py-3 text-sm font-black text-lime-300 transition hover:bg-lime-300/10">View live leaderboard</Link></div>
      </main>
    </div>
  );
}

function Metric({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"><span className="text-lime-300">{icon}</span><p className="mt-4 text-xs font-black uppercase tracking-wider text-slate-500">{label}</p><p className="mt-2 text-3xl font-black">{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div>;
}

function AwardCard({ award }: { award: WeeklyAward }) {
  const href = award.entityType === 'USER' ? `/participants/${award.entityId}` : '/leaderboard';
  return <Link href={href} className="rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:border-lime-300/30"><div className="text-2xl">{award.emoji}</div><p className="mt-3 text-xs font-black uppercase tracking-wider text-lime-300">{award.label}</p><p className="mt-1 text-lg font-black">{award.entityName}</p><p className="mt-1 text-sm text-slate-400">{award.displayValue}</p></Link>;
}

function Standings({ title, rows, athlete = false }: { title: string; rows: Array<{ id: string; name: string; rank: number; points: number; detail: string }>; athlete?: boolean }) {
  return <div><h3 className="text-sm font-black uppercase tracking-wider text-slate-500">{title}</h3><div className="mt-3 overflow-hidden rounded-xl border border-white/10">{rows.map((row) => <div key={row.id} className="flex items-center gap-3 border-b border-white/5 px-4 py-3 last:border-0"><span className="w-7 text-sm font-black text-slate-500">#{row.rank}</span><div className="min-w-0 flex-1">{athlete ? <Link href={`/participants/${row.id}`} className="truncate text-sm font-bold hover:text-lime-300">{row.name}</Link> : <p className="truncate text-sm font-bold">{row.name}</p>}<p className="text-[0.65rem] text-slate-600">{row.detail}</p></div><span className="text-sm font-black text-lime-300">{row.points.toFixed(1)}</span></div>)}</div></div>;
}

function formatDate(value: Date) {
  return new Date(value).toLocaleDateString('en-SG', { timeZone: 'Asia/Singapore', day: 'numeric', month: 'short' });
}
function formatDateTime(value: Date) {
  return new Date(value).toLocaleString('en-SG', { timeZone: 'Asia/Singapore', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
