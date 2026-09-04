'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Activity, ArrowRight, Clock3, Flame, Medal, RefreshCw, Sparkles, Trophy, Users } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { formatDistance, formatDuration, formatPace } from '@/lib/format';
import { getMapboxStaticMapUrl } from '@/lib/mapbox';

interface IndividualLeader {
  userId: string;
  userName: string;
  columnName: string;
  totalPoints: number;
}

interface TeamLeader {
  columnId: string;
  columnName: string;
  memberCount: number;
  totalPoints: number;
  averagePoints: number;
}

interface RecentActivity {
  id: string;
  category: string;
  distance: number;
  points: number;
  proofUrl?: string;
  stravaActivityId?: string;
  mapPolyline?: string;
  elevationGain?: number;
  duration?: number;
  pace?: number;
  user: { id: string; name: string };
}

const REFRESH_INTERVAL_MS = 60_000;
const rankLabel = (index: number) => index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}`;
const activityLabel = (category: string) =>
  category.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function Home() {
  const [individuals, setIndividuals] = useState<IndividualLeader[]>([]);
  const [teams, setTeams] = useState<TeamLeader[]>([]);
  const [activities, setActivities] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [enlargedPhoto, setEnlargedPhoto] = useState<string | null>(null);

  const loadDashboard = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const responses = await Promise.all([
        fetch('/api/leaderboard?type=individual', { cache: 'no-store' }),
        fetch('/api/leaderboard?type=team', { cache: 'no-store' }),
        fetch('/api/activities?status=APPROVED&limit=8', { cache: 'no-store' }),
      ]);
      if (responses.some((response) => !response.ok)) throw new Error('Dashboard request failed');
      const [individual, team, recent] = await Promise.all(responses.map((response) => response.json()));
      setIndividuals(individual.leaderboard ?? []);
      setTeams(team.leaderboard ?? []);
      setActivities(Array.isArray(recent) ? recent : []);
      setUpdatedAt(new Date());
    } catch (error) {
      console.error('Error fetching dashboard:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => loadDashboard(), 0);
    const interval = window.setInterval(() => loadDashboard(true), REFRESH_INTERVAL_MS);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
    };
  }, [loadDashboard]);

  const stats = useMemo(() => ({
    participants: individuals.length,
    totalPoints: individuals.reduce((sum, person) => sum + person.totalPoints, 0),
    leadingColumn: teams[0]?.columnName ?? 'Waiting for scores',
    leadingMember: individuals[0]?.userName ?? 'Be the first',
  }), [individuals, teams]);

  const maxIndividual = individuals[0]?.totalPoints || 1;
  const maxTeam = teams[0]?.totalPoints || 1;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Navbar />
      <main>
        <section className="relative overflow-hidden border-b border-white/10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.34),_transparent_40%),radial-gradient(circle_at_80%_20%,_rgba(249,115,22,0.22),_transparent_30%)]" />
          <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
            <div className="grid items-end gap-12 lg:grid-cols-[1.25fr_0.75fr]">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full border border-orange-400/30 bg-orange-400/10 px-3 py-1 text-sm font-medium text-orange-200">
                  <Flame className="h-4 w-4" /> Kilo Golf Stay Active Challenge
                </span>
                <h1 className="mt-6 max-w-4xl text-4xl font-black tracking-tight sm:text-6xl lg:text-7xl">
                  Every activity moves your <span className="text-orange-400">column forward.</span>
                </h1>
                <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
                  Log your effort, climb the ranks, and help your column take the lead. Standings update automatically throughout the day.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link href="/activities/new" className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-6 py-3 font-bold shadow-lg shadow-orange-500/20 transition hover:-translate-y-0.5 hover:bg-orange-400">
                    Log activity <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link href="/leaderboard" className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-6 py-3 font-bold transition hover:bg-white/10">
                    Full leaderboard <Trophy className="h-4 w-4 text-yellow-400" />
                  </Link>
                </div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
                <div className="flex items-center justify-between">
                  <div><p className="text-sm text-slate-400">Competition leader</p><p className="mt-1 text-2xl font-black">{stats.leadingColumn}</p></div>
                  <div className="rounded-2xl bg-yellow-400/15 p-3 text-yellow-300"><Trophy className="h-7 w-7" /></div>
                </div>
                <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full w-full rounded-full bg-gradient-to-r from-yellow-400 to-orange-500" /></div>
                <div className="mt-5 flex items-center justify-between text-sm"><span className="text-slate-400">Top athlete</span><span className="font-semibold text-orange-300">{stats.leadingMember}</span></div>
              </div>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-7xl space-y-12 px-4 py-10 sm:px-6 lg:px-8">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Active participants" value={stats.participants.toLocaleString()} icon={<Users />} tone="text-sky-300 bg-sky-400/10" loading={loading} />
            <Stat label="Points earned" value={stats.totalPoints.toFixed(1)} icon={<Sparkles />} tone="text-violet-300 bg-violet-400/10" loading={loading} />
            <Stat label="Columns competing" value={teams.length.toLocaleString()} icon={<Medal />} tone="text-yellow-300 bg-yellow-400/10" loading={loading} />
            <Stat label="Recent activities" value={activities.length.toLocaleString()} icon={<Activity />} tone="text-emerald-300 bg-emerald-400/10" loading={loading} />
          </div>

          <section>
            <SectionHeading eyebrow="Live standings" title="The race right now">
              <button onClick={() => loadDashboard(true)} disabled={refreshing} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300 transition hover:bg-white/5 disabled:opacity-50">
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                {updatedAt ? `Updated ${updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Refresh'}
              </button>
            </SectionHeading>
            <div className="grid gap-5 lg:grid-cols-2">
              <Board title="Individual leaders" icon={<Trophy className="h-5 w-5 text-yellow-300" />} href="/leaderboard">
                {loading ? <Skeleton /> : individuals.length ? individuals.slice(0, 6).map((person, index) => (
                  <Link key={person.userId} href={`/participants/${person.userId}`} className="grid w-full grid-cols-[2.5rem_1fr_auto] items-center gap-3 border-t border-white/5 px-5 py-3.5 text-left transition hover:bg-white/5">
                    <span className="text-center font-black text-slate-300">{rankLabel(index)}</span>
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{person.userName}</span>
                      <span className="block text-xs text-slate-500">{person.columnName}</span>
                      <Progress value={person.totalPoints / maxIndividual * 100} colour="bg-orange-400" />
                    </span>
                    <span className="font-black text-orange-300">{person.totalPoints.toFixed(1)}</span>
                  </Link>
                )) : <Empty />}
              </Board>
              <Board title="Column standings" icon={<Users className="h-5 w-5 text-sky-300" />} href="/leaderboard?view=team">
                {loading ? <Skeleton /> : teams.length ? teams.slice(0, 6).map((team, index) => (
                  <div key={team.columnId} className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 border-t border-white/5 px-5 py-3.5">
                    <span className="text-center font-black text-slate-300">{rankLabel(index)}</span>
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{team.columnName}</span>
                      <span className="block text-xs text-slate-500">{team.memberCount} members · {team.averagePoints.toFixed(1)} avg</span>
                      <Progress value={team.totalPoints / maxTeam * 100} colour="bg-sky-400" />
                    </span>
                    <span className="font-black text-sky-300">{team.totalPoints.toFixed(1)}</span>
                  </div>
                )) : <Empty />}
              </Board>
            </div>
          </section>

          <section>
            <SectionHeading eyebrow="Activity feed" title="Fresh from the field"><Clock3 className="h-6 w-6 text-slate-600" /></SectionHeading>
            {loading ? <Skeleton /> : activities.length ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {activities.map((activity) => {
                  const mapUrl = getMapboxStaticMapUrl(activity.mapPolyline, { width: 400, height: 300 });
                  const preview = activity.proofUrl || mapUrl;
                  return (
                    <div key={activity.id} className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] text-left transition hover:-translate-y-1 hover:border-white/20">
                      {preview ? <button type="button" onClick={() => setEnlargedPhoto(preview)} aria-label={`Enlarge ${activity.user.name}'s activity proof`} className="relative flex h-36 w-full items-center justify-center overflow-hidden bg-slate-900">
                        <Image src={preview} alt={`${activity.user.name}'s activity`} fill unoptimized sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw" className="object-cover transition duration-500 group-hover:scale-105" />
                        <span className="absolute right-3 top-3 rounded-full bg-slate-950/80 px-2.5 py-1 text-xs font-bold text-orange-300 backdrop-blur">+{activity.points.toFixed(1)} pts</span>
                      </button> : <Link href={`/participants/${activity.user.id}`} className="relative flex h-36 items-center justify-center overflow-hidden bg-slate-900"><Activity className="h-14 w-14 text-slate-700" /><span className="absolute right-3 top-3 rounded-full bg-slate-950/80 px-2.5 py-1 text-xs font-bold text-orange-300 backdrop-blur">+{activity.points.toFixed(1)} pts</span></Link>}
                      <div className="p-4">
                        <Link href={`/participants/${activity.user.id}`} className="font-bold transition hover:text-orange-300">{activity.user.name}</Link>
                        <p className="mt-1 text-sm text-slate-400">{activityLabel(activity.category)}{activity.distance ? ` · ${formatDistance(activity.distance)}${activity.category === 'SWIM' ? 'm' : 'km'}` : ''}</p>
                        {(activity.duration || activity.pace || activity.elevationGain) && <p className="mt-2 text-xs text-slate-500">{[activity.duration ? formatDuration(activity.duration) : null, activity.pace ? `${formatPace(activity.pace)}/km` : null, activity.elevationGain ? `${Math.round(activity.elevationGain)}m elev` : null].filter(Boolean).join(' · ')}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : <Empty />}
          </section>
        </div>
      </main>

      {enlargedPhoto && <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={() => setEnlargedPhoto(null)}><div className="relative h-full w-full"><Image src={enlargedPhoto} alt="Activity proof enlarged" fill unoptimized sizes="100vw" className="rounded-xl object-contain shadow-2xl" /></div></div>}
    </div>
  );
}

function Stat({ label, value, icon, tone, loading }: { label: string; value: string; icon: React.ReactNode; tone: string; loading: boolean }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"><div className={`inline-flex rounded-xl p-2.5 [&>svg]:h-5 [&>svg]:w-5 ${tone}`}>{icon}</div><p className="mt-5 text-3xl font-black">{loading ? '—' : value}</p><p className="mt-1 text-sm text-slate-400">{label}</p></div>;
}

function SectionHeading({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-400">{eyebrow}</p><h2 className="mt-1 text-3xl font-black">{title}</h2></div>{children}</div>;
}

function Board({ title, icon, href, children }: { title: string; icon: React.ReactNode; href: string; children: React.ReactNode }) {
  return <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]"><div className="flex items-center justify-between p-5"><h3 className="flex items-center gap-2 text-lg font-black">{icon}{title}</h3><Link href={href} className="text-sm font-semibold text-slate-400 transition hover:text-white">View all</Link></div>{children}</div>;
}

function Progress({ value, colour }: { value: number; colour: string }) {
  return <span className="mt-2 block h-1 overflow-hidden rounded-full bg-white/10"><span className={`block h-full rounded-full ${colour}`} style={{ width: `${Math.max(4, value)}%` }} /></span>;
}

function Skeleton() {
  return <div className="space-y-3 p-5"><div className="h-12 animate-pulse rounded-xl bg-white/5" /><div className="h-12 animate-pulse rounded-xl bg-white/5" /><div className="h-12 animate-pulse rounded-xl bg-white/5" /></div>;
}

function Empty() {
  return <div className="p-8 text-center text-sm text-slate-500">No approved activities yet. The first move is yours.</div>;
}
