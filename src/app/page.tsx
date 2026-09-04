'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Activity, ArrowRight, Clock3, Medal, RefreshCw, Sparkles, Trophy, Users } from 'lucide-react';
import Navbar from '@/components/Navbar';
import HeroAtmosphere, { ActivityTicker } from '@/components/HeroAtmosphere';
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
        <section className="hero-stage border-b border-white/10 bg-slate-950">
          <HeroAtmosphere />
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
            <div className="grid items-center gap-12 lg:grid-cols-[1.08fr_0.92fr]">
              <div>
                <span className="live-pulse hero-reveal inline-flex items-center gap-2.5 rounded-full border border-lime-300/25 bg-lime-300/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-lime-200">
                  Challenge live
                </span>
                <h1 className="athletic-display hero-reveal hero-reveal-delay-1 mt-6 max-w-4xl text-5xl leading-[0.88] sm:text-7xl lg:text-[5.7rem]">
                  Move more.<br />Climb higher.<br /><span className="text-orange-400">Win together.</span>
                </h1>
                <p className="hero-reveal hero-reveal-delay-2 mt-7 max-w-xl text-base leading-7 text-slate-300 sm:text-lg">
                  Every approved effort moves you and your column up the live standings. Run, ride, swim, hike—or rally the whole troop.
                </p>
                <div className="hero-reveal hero-reveal-delay-3 mt-8 flex flex-wrap gap-3">
                  <Link href="/activities/new" className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-6 py-3 font-bold shadow-lg shadow-orange-500/25 transition hover:-translate-y-0.5 hover:bg-orange-400">
                    Log activity <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link href="/leaderboard" className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-6 py-3 font-bold backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/10">
                    Watch the race <Trophy className="h-4 w-4 text-lime-300" />
                  </Link>
                </div>
              </div>

              <div className="hero-reveal hero-reveal-delay-2 relative rounded-3xl border border-white/10 bg-slate-900/70 p-5 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-7">
                <div className="flex items-center justify-between gap-4">
                  <div><p className="text-xs font-black uppercase tracking-[0.18em] text-lime-300">Live column race</p><p className="mt-2 text-2xl font-black">{stats.leadingColumn}</p></div>
                  <span className="rounded-2xl bg-lime-300 p-3 text-slate-950"><Trophy className="h-6 w-6" /></span>
                </div>
                <div className="mt-8 space-y-5">
                  {(loading ? [null, null, null] : teams.slice(0, 3)).map((team, index) => {
                    const score = team?.totalPoints ?? 0;
                    const width = team ? Math.max(16, score / maxTeam * 100) : 36 + index * 18;
                    return <div key={team?.columnId ?? index}>
                      <div className="mb-2 flex items-end justify-between gap-3"><span className="truncate text-sm font-bold text-slate-200">{team ? `${index + 1}. ${team.columnName}` : 'Loading column…'}</span><span className="text-sm font-black text-orange-300">{team ? score.toFixed(1) : '—'}</span></div>
                      <div className="h-2 overflow-hidden rounded-full bg-white/5"><div className={`h-full rounded-full ${index === 0 ? 'bg-gradient-to-r from-lime-300 to-yellow-300' : 'bg-gradient-to-r from-sky-500 to-cyan-300'} transition-[width] duration-700`} style={{ width: `${width}%` }} /></div>
                    </div>;
                  })}
                </div>
                <div className="mt-7 grid grid-cols-2 gap-3 border-t border-white/10 pt-5">
                  <div><p className="text-xs text-slate-500">Top athlete</p><p className="mt-1 truncate font-black text-orange-200">{stats.leadingMember}</p></div>
                  <div className="text-right"><p className="text-xs text-slate-500">Points in play</p><p className="mt-1 font-black text-lime-300">{loading ? '—' : stats.totalPoints.toFixed(1)}</p></div>
                </div>
              </div>
            </div>
          </div>
          <ActivityTicker />
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
