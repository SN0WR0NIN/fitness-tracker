import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Activity, ArrowLeft, Bike, Footprints, Medal, TrendingDown, TrendingUp, Trophy, Users, Waves } from 'lucide-react';
import Navbar from '@/components/Navbar';
import HeroAtmosphere from '@/components/HeroAtmosphere';
import { getActiveColumnIds } from '@/lib/admin-control';
import { formatDistance } from '@/lib/format';
import { prisma } from '@/lib/prisma';
import { getRankingDynamics } from '@/lib/ranking-dynamics';

export const dynamic = 'force-dynamic';

type ActivityCategory = 'RUN' | 'CYCLE' | 'SWIM' | 'WALK_OR_HIKE' | 'TROOP_GAMES';
type ColumnData = {
  id: string;
  name: string;
  members: Array<{ id: string; name: string; weeklyScores: Array<{ totalPoints: number }> }>;
};
type ColumnScoreRow = { columnId: string; _sum: { points: number | null } };
type CategoryScoreRow = { category: ActivityCategory; _sum: { points: number | null } };
type RecentActivity = { id: string; category: ActivityCategory; distance: number; points: number; occurredAt: Date; user: { id: string; name: string } };

const categoryMeta = {
  RUN: { label: 'Run', icon: Footprints, colour: 'bg-lime-300' },
  CYCLE: { label: 'Cycle', icon: Bike, colour: 'bg-cyan-300' },
  SWIM: { label: 'Swim', icon: Waves, colour: 'bg-violet-300' },
  WALK_OR_HIKE: { label: 'Walk / Hike', icon: Activity, colour: 'bg-orange-300' },
  TROOP_GAMES: { label: 'Troop Games', icon: Users, colour: 'bg-fuchsia-300' },
} as const;

export default async function ColumnPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [columnResult, activeColumnIds, scoreRowsResult, categoryRowsResult, recentActivitiesResult] = await Promise.all([
    prisma.column.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        members: { select: { id: true, name: true, weeklyScores: { select: { totalPoints: true } } } },
      },
    }),
    getActiveColumnIds(),
    prisma.activity.groupBy({ by: ['columnId'], where: { status: 'APPROVED' }, _sum: { points: true } }),
    prisma.activity.groupBy({ by: ['category'], where: { status: 'APPROVED', columnId: id }, _sum: { points: true } }),
    prisma.activity.findMany({ where: { status: 'APPROVED', columnId: id }, orderBy: { occurredAt: 'desc' }, take: 8, select: { id: true, category: true, distance: true, points: true, occurredAt: true, user: { select: { id: true, name: true } } } }),
  ]);
  const column = columnResult as ColumnData | null;
  const scoreRows = scoreRowsResult as ColumnScoreRow[];
  const categoryRows = categoryRowsResult as CategoryScoreRow[];
  const recentActivities = recentActivitiesResult as RecentActivity[];
  if (!column || !activeColumnIds.includes(column.id)) notFound();

  const scoresByColumn = new Map(scoreRows.map((row) => [row.columnId, row._sum.points ?? 0]));
  const rankedColumns = activeColumnIds
    .map((columnId) => ({ id: columnId, points: scoresByColumn.get(columnId) ?? 0 }))
    .sort((a, b) => b.points - a.points);
  const dynamics = await getRankingDynamics('column', 'all-time', rankedColumns);
  const columnDynamics = dynamics.get(column.id);
  const totalPoints = scoresByColumn.get(column.id) ?? 0;
  const averagePoints = column.members.length ? totalPoints / column.members.length : 0;
  const initials = column.name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  const members = column.members.map((member) => ({
    id: member.id,
    name: member.name,
    points: member.weeklyScores.reduce((sum, score) => sum + score.totalPoints, 0),
  })).sort((a, b) => b.points - a.points);
  const maxMemberPoints = members[0]?.points || 1;
  const categoryScores = new Map(categoryRows.map((row) => [row.category, row._sum.points ?? 0]));
  const categoryPoints = Object.keys(categoryMeta).map((key) => {
    const category = key as keyof typeof categoryMeta;
    return { category, points: categoryScores.get(category) ?? 0 };
  });

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Navbar />
      <main>
        <section className="hero-stage border-b border-white/10 bg-slate-950">
          <HeroAtmosphere />
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
            <Link href="/leaderboard" className="hero-reveal inline-flex items-center gap-2 text-sm font-bold text-slate-400 transition hover:text-white"><ArrowLeft className="h-4 w-4" />Back to standings</Link>
            <div className="mt-8 grid items-end gap-8 lg:grid-cols-[1fr_auto]">
              <div className="hero-reveal hero-reveal-delay-1 flex items-center gap-5">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-gradient-to-br from-cyan-300 to-blue-600 text-2xl font-black text-slate-950 shadow-xl shadow-cyan-300/15">{initials}</div>
                <div><p className="live-pulse inline-flex items-center gap-2.5 text-xs font-black uppercase tracking-[0.2em] text-lime-300">Column performance</p><h1 className="athletic-display mt-3 text-5xl leading-none sm:text-7xl">{column.name}</h1><p className="mt-2 text-slate-400">{column.members.length} athletes competing together</p></div>
              </div>
              <div className="hero-reveal hero-reveal-delay-2 grid grid-cols-3 gap-3">
                <HeroMetric label="Rank" value={columnDynamics ? `#${columnDynamics.rank}` : '—'} />
                <HeroMetric label="Points" value={totalPoints.toFixed(1)} />
                <HeroMetric label="Average" value={averagePoints.toFixed(1)} />
              </div>
            </div>
            <div className="hero-reveal hero-reveal-delay-3 mt-8 flex flex-wrap gap-3 text-xs font-bold">
              <Movement change={columnDynamics?.rankChange ?? null} isNew={columnDynamics?.isNew ?? false} />
              {columnDynamics?.rank === 1 ? <span className="rounded-full bg-lime-300/10 px-3 py-1.5 text-lime-300">Defending the lead</span> : <span className="rounded-full bg-orange-300/10 px-3 py-1.5 text-orange-200">{columnDynamics?.pointsToNext.toFixed(1) ?? '—'} points to overtake</span>}
            </div>
          </div>
        </section>

        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:px-8">
          <div className="space-y-6">
            <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
              <SectionTitle icon={<Trophy />} title="Member standings" subtitle="Every approved point contributing to the column" />
              <div className="mt-6 space-y-2">
                {members.map((member, index) => <Link key={member.id} href={`/participants/${member.id}`} className="group grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl border border-white/5 bg-black/10 p-3 transition hover:border-cyan-300/20 hover:bg-cyan-300/[0.04]"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-sm font-black text-slate-400">{index + 1}</span><span className="min-w-0"><span className="block truncate font-black">{member.name}</span><span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-white/5"><span className="block h-full rounded-full bg-gradient-to-r from-cyan-400 to-lime-300" style={{ width: `${Math.max(member.points ? 4 : 0, member.points / maxMemberPoints * 100)}%` }} /></span></span><span className="font-black text-cyan-300">{member.points.toFixed(1)}</span></Link>)}
                {!members.length ? <Empty message="No athletes are assigned to this column yet." /> : null}
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
              <SectionTitle icon={<Activity />} title="Recent activity" subtitle="Latest approved efforts from this column" />
              <div className="mt-6 space-y-2">{recentActivities.map((item) => { const meta = categoryMeta[item.category]; const Icon = meta.icon; return <Link key={item.id} href={`/participants/${item.user.id}`} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl border border-white/5 bg-black/10 p-3 transition hover:bg-white/5"><span className="rounded-lg bg-white/5 p-2 text-slate-300"><Icon className="h-4 w-4" /></span><span className="min-w-0"><span className="block truncate font-bold">{item.user.name}</span><span className="block text-xs text-slate-500">{meta.label}{item.distance ? ` · ${formatDistance(item.distance)}${item.category === 'SWIM' ? 'm' : 'km'}` : ''} · {item.occurredAt.toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })}</span></span><span className="font-black text-orange-300">+{item.points.toFixed(1)}</span></Link>; })}{!recentActivities.length ? <Empty message="No approved activities yet." /> : null}</div>
            </section>
          </div>

          <div className="space-y-6">
            <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
              <SectionTitle icon={<Medal />} title="Activity mix" subtitle="Points earned by activity type" />
              <div className="mt-6 space-y-5">{categoryPoints.map(({ category, points }) => { const meta = categoryMeta[category]; const Icon = meta.icon; return <div key={category}><div className="flex items-center justify-between gap-3 text-sm"><span className="flex items-center gap-2 font-bold text-slate-300"><Icon className="h-4 w-4" />{meta.label}</span><span className="font-black">{points.toFixed(1)}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-white/5"><div className={`h-full rounded-full ${meta.colour}`} style={{ width: `${totalPoints ? Math.max(points ? 3 : 0, points / totalPoints * 100) : 0}%` }} /></div></div>; })}</div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
              <SectionTitle icon={<TrendingUp />} title="Seven-day rank history" subtitle="Daily snapshots begin from this release" />
              <div className="mt-6 grid grid-cols-7 gap-2">{columnDynamics?.history.map((point) => <div key={point.date} className="rounded-xl border border-white/5 bg-black/10 p-2 text-center"><p className="text-[0.6rem] text-slate-600">{new Date(`${point.date}T00:00:00Z`).toLocaleDateString('en-SG', { weekday: 'short' })}</p><p className="mt-2 text-lg font-black text-lime-300">#{point.rank}</p><p className="mt-1 text-[0.6rem] text-slate-500">{point.points.toFixed(0)}</p></div>)}</div>
              {!columnDynamics?.history.length ? <Empty message="The first daily snapshot will appear shortly." /> : null}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) { return <div className="min-w-24 rounded-2xl border border-white/10 bg-white/[0.05] p-4 text-center backdrop-blur"><p className="text-[0.65rem] font-black uppercase tracking-wider text-slate-500">{label}</p><p className="mt-2 text-2xl font-black text-cyan-200">{value}</p></div>; }
function SectionTitle({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) { return <div className="flex items-start gap-3"><span className="rounded-xl bg-cyan-300/10 p-2.5 text-cyan-300 [&>svg]:h-5 [&>svg]:w-5">{icon}</span><div><h2 className="text-lg font-black">{title}</h2><p className="mt-1 text-sm text-slate-500">{subtitle}</p></div></div>; }
function Empty({ message }: { message: string }) { return <div className="py-8 text-center text-sm text-slate-500">{message}</div>; }
function Movement({ change, isNew }: { change: number | null; isNew: boolean }) { if (isNew) return <span className="rounded-full bg-violet-300/10 px-3 py-1.5 text-violet-300">New to the standings</span>; if (!change) return <span className="rounded-full bg-white/5 px-3 py-1.5 text-slate-400">Rank unchanged</span>; return <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 ${change > 0 ? 'bg-emerald-300/10 text-emerald-300' : 'bg-rose-300/10 text-rose-300'}`}>{change > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}{change > 0 ? `Up ${change}` : `Down ${Math.abs(change)}`} places</span>; }
