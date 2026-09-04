'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Activity, Bike, Crown, Footprints, RefreshCw, Search, Trophy, Users, Waves } from 'lucide-react';
import Navbar from '@/components/Navbar';
import HeroAtmosphere from '@/components/HeroAtmosphere';

interface IndividualLeader {
  userId: string;
  userName: string;
  columnName: string;
  totalPoints: number;
  runPoints: number;
  cyclePoints: number;
  swimPoints: number;
  hikePoints: number;
  troopGamePoints: number;
}

interface TeamLeader {
  columnId: string;
  columnName: string;
  memberCount: number;
  totalPoints: number;
  averagePoints: number;
}

type Category = 'totalPoints' | 'runPoints' | 'cyclePoints' | 'swimPoints' | 'hikePoints' | 'troopGamePoints';
const REFRESH_INTERVAL_MS = 60_000;
const rankLabel = (index: number) => index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1;
const initials = (name: string) => name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();

const categories: { key: Category; label: string; icon: React.ReactNode }[] = [
  { key: 'totalPoints', label: 'Overall', icon: <Trophy /> },
  { key: 'runPoints', label: 'Run', icon: <Footprints /> },
  { key: 'cyclePoints', label: 'Cycle', icon: <Bike /> },
  { key: 'swimPoints', label: 'Swim', icon: <Waves /> },
  { key: 'hikePoints', label: 'Hike', icon: <Activity /> },
  { key: 'troopGamePoints', label: 'Troop games', icon: <Users /> },
];

export default function LeaderboardPage() {
  const { data: session } = useSession();
  const [view, setView] = useState<'individual' | 'team'>('individual');
  const [week, setWeek] = useState('all');
  const [category, setCategory] = useState<Category>('totalPoints');
  const [teamMetric, setTeamMetric] = useState<'totalPoints' | 'averagePoints'>('totalPoints');
  const [query, setQuery] = useState('');
  const [individuals, setIndividuals] = useState<IndividualLeader[]>([]);
  const [teams, setTeams] = useState<TeamLeader[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const loadLeaderboard = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const suffix = week === 'all' ? '' : `&weekNumber=${week}`;
      const [individualResponse, teamResponse] = await Promise.all([
        fetch(`/api/leaderboard?type=individual${suffix}`, { cache: 'no-store' }),
        fetch(`/api/leaderboard?type=team${suffix}`, { cache: 'no-store' }),
      ]);
      if (!individualResponse.ok || !teamResponse.ok) throw new Error('Leaderboard request failed');
      const [individualData, teamData] = await Promise.all([individualResponse.json(), teamResponse.json()]);
      setIndividuals(individualData.leaderboard ?? []);
      setTeams(teamData.leaderboard ?? []);
      setUpdatedAt(new Date());
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [week]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => loadLeaderboard(), 0);
    const interval = window.setInterval(() => loadLeaderboard(true), REFRESH_INTERVAL_MS);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
    };
  }, [loadLeaderboard]);

  const rankedIndividuals = useMemo(() => [...individuals].sort((a, b) => b[category] - a[category]), [individuals, category]);
  const individualResults = useMemo(() => rankedIndividuals
    .filter((person) => `${person.userName} ${person.columnName}`.toLowerCase().includes(query.toLowerCase())), [rankedIndividuals, query]);

  const rankedTeams = useMemo(() => [...teams].sort((a, b) => b[teamMetric] - a[teamMetric]), [teams, teamMetric]);
  const teamResults = useMemo(() => rankedTeams
    .filter((team) => team.columnName.toLowerCase().includes(query.toLowerCase())), [rankedTeams, query]);
  const individualRankMap = useMemo(() => new Map(rankedIndividuals.map((person, index) => [person.userId, index])), [rankedIndividuals]);
  const teamRankMap = useMemo(() => new Map(rankedTeams.map((team, index) => [team.columnId, index])), [rankedTeams]);

  const podium = view === 'individual' ? rankedIndividuals.slice(0, 3) : rankedTeams.slice(0, 3);
  const currentUserIndex = session?.user?.id ? individualRankMap.get(session.user.id) ?? -1 : -1;
  const currentUser = currentUserIndex >= 0 ? rankedIndividuals[currentUserIndex] : null;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Navbar />
      <main>
        <section className="hero-stage border-b border-white/10 bg-slate-950">
          <HeroAtmosphere />
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[0.82fr_1.18fr] lg:px-8 lg:py-20">
            <div>
              <p className="live-pulse hero-reveal inline-flex items-center gap-2.5 text-xs font-black uppercase tracking-[0.22em] text-lime-300">Live competition</p>
              <h1 className="athletic-display hero-reveal hero-reveal-delay-1 mt-5 text-6xl leading-[0.9] sm:text-8xl">The race<br /><span className="text-orange-400">right now.</span></h1>
              <p className="hero-reveal hero-reveal-delay-2 mt-6 max-w-md leading-7 text-slate-400">Rankings update every minute. Switch the activity, week, or team view to see who owns the moment.</p>
              <button onClick={() => loadLeaderboard(true)} disabled={refreshing} className="hero-reveal hero-reveal-delay-3 mt-7 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-300 backdrop-blur transition hover:bg-white/10 disabled:opacity-50">
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                {updatedAt ? `Updated ${updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Refresh standings'}
              </button>
            </div>

            <div className="hero-reveal hero-reveal-delay-2 rounded-3xl border border-white/10 bg-slate-900/75 p-4 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-6">
              <div className="mb-5 flex items-center justify-between gap-3"><p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Top three · {week === 'all' ? 'All time' : `Week ${week}`}</p><Trophy className="h-5 w-5 text-lime-300" /></div>
              {loading ? <div className="h-64 animate-pulse rounded-2xl bg-white/5" /> : podium.length ? (
                <div className="grid min-h-72 grid-cols-3 items-end gap-2 pt-8 sm:gap-3">
                  {podium.map((entry, index) => {
                    const isPerson = 'userId' in entry;
                    const score = isPerson ? entry[category] : entry[teamMetric];
                    const order = index === 0 ? 'order-2' : index === 1 ? 'order-1' : 'order-3';
                    const content = <>
                      <span className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full border text-sm font-black sm:h-16 sm:w-16 sm:text-lg ${index === 0 ? 'border-lime-300/40 bg-lime-300 text-slate-950 shadow-lg shadow-lime-300/20' : index === 1 ? 'border-slate-300/30 bg-slate-300/15 text-slate-100' : 'border-orange-300/30 bg-orange-300/10 text-orange-200'}`}>{isPerson ? initials(entry.userName) : initials(entry.columnName)}</span>
                      <span className="mt-3 block w-full truncate text-sm font-black sm:text-base">{isPerson ? entry.userName : entry.columnName}</span>
                      <span className="mt-1 block w-full truncate text-[0.65rem] text-slate-500 sm:text-xs">{isPerson ? entry.columnName : `${entry.memberCount} members`}</span>
                      <span className="mt-4 block text-lg font-black text-orange-300 sm:text-2xl">{score.toFixed(1)} <span className="text-[0.6rem] font-bold uppercase tracking-wider text-slate-500">pts</span></span>
                      <span className="mt-3 block h-1.5 overflow-hidden rounded-full bg-white/5"><span className={`block h-full w-full rounded-full ${index === 0 ? 'bg-gradient-to-r from-lime-300 to-yellow-300' : 'bg-gradient-to-r from-orange-500 to-yellow-400'}`} /></span>
                    </>;
                    const className = `standing-row-enter ${order} relative min-w-0 rounded-2xl border p-3 text-center transition hover:-translate-y-1 sm:p-4 ${index === 0 ? 'min-h-64 border-lime-300/30 bg-gradient-to-b from-lime-300/15 to-lime-300/[0.04] shadow-xl shadow-lime-300/5 [animation-delay:100ms]' : 'min-h-56 border-white/10 bg-white/[0.04]'} ${index === 2 ? '[animation-delay:200ms]' : ''}`;
                    const rankMark = index === 0 ? <Crown className="h-5 w-5" /> : <span>{rankLabel(index)}</span>;
                    const wrappedContent = <>{<span className={`absolute left-1/2 top-0 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full px-2.5 py-1 text-sm font-black ${index === 0 ? 'bg-lime-300 text-slate-950' : 'border border-white/10 bg-slate-950 text-white'}`}>{rankMark}</span>}{content}</>;
                    return isPerson ? <Link key={entry.userId} href={`/participants/${entry.userId}`} className={className}>{wrappedContent}</Link> : <div key={entry.columnId} className={className}>{wrappedContent}</div>;
                  })}
                </div>
              ) : <div className="flex h-64 items-center justify-center text-sm text-slate-500">No scores yet. Be first on the podium.</div>}
            </div>
          </div>
        </section>

        <div className={`mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 ${currentUser ? 'pb-28' : ''}`}>
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-4 shadow-xl shadow-black/10">
          <div className="mb-4"><p className="text-xs font-black uppercase tracking-[0.18em] text-lime-300">Standings controls</p><p className="mt-1 text-sm text-slate-500">Choose a leaderboard, activity and time period.</p></div>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex rounded-xl bg-black/20 p-1">
              <button onClick={() => setView('individual')} className={`flex-1 rounded-lg px-5 py-2 text-sm font-bold transition ${view === 'individual' ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white'}`}>Individual</button>
              <button onClick={() => setView('team')} className={`flex-1 rounded-lg px-5 py-2 text-sm font-bold transition ${view === 'team' ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white'}`}>Column</button>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <label className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={view === 'individual' ? 'Search name or column' : 'Search column'} className="w-full rounded-xl border border-white/10 bg-black/20 py-2.5 pl-9 pr-4 text-sm outline-none placeholder:text-slate-600 focus:border-orange-400 sm:w-56" />
              </label>
              <select value={week} onChange={(event) => setWeek(event.target.value)} className="rounded-xl border border-white/10 bg-slate-900 px-4 py-2.5 text-sm outline-none focus:border-orange-400">
                <option value="all">All time</option>
                {[1, 2, 3, 4, 5].map((number) => <option key={number} value={number}>Week {number}</option>)}
              </select>
              {view === 'team' && <select value={teamMetric} onChange={(event) => setTeamMetric(event.target.value as typeof teamMetric)} className="rounded-xl border border-white/10 bg-slate-900 px-4 py-2.5 text-sm outline-none focus:border-orange-400"><option value="totalPoints">Total points</option><option value="averagePoints">Average points</option></select>}
            </div>
          </div>
          {view === 'individual' && <div className="mt-4 flex gap-2 overflow-x-auto pb-1">{categories.map((item) => <button key={item.key} onClick={() => setCategory(item.key)} className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-xs font-bold transition [&>svg]:h-4 [&>svg]:w-4 ${category === item.key ? 'bg-white text-slate-950' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}>{item.icon}{item.label}</button>)}</div>}
        </div>

        <div className="mt-5 space-y-2">
          {loading ? <LoadingRows /> : view === 'individual' ? (
            individualResults.length ? individualResults.map((person) => {
              const actualIndex = individualRankMap.get(person.userId) ?? 0;
              const max = rankedIndividuals[0]?.[category] || 1;
              const isCurrentUser = person.userId === session?.user?.id;
              return <Link key={person.userId} href={`/participants/${person.userId}`} style={{ animationDelay: `${Math.min(actualIndex, 10) * 45}ms` }} className={`standing-row-enter group grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl border px-3 py-3.5 text-left transition hover:-translate-y-0.5 sm:grid-cols-[auto_auto_1fr_auto] sm:gap-4 sm:px-5 ${isCurrentUser ? 'border-lime-300/30 bg-lime-300/[0.08] shadow-lg shadow-lime-300/5' : 'border-white/[0.07] bg-white/[0.035] hover:border-white/15 hover:bg-white/[0.06]'}`}>
                <span className={`flex h-9 w-9 items-center justify-center rounded-xl text-sm font-black ${actualIndex < 3 ? 'bg-white/10' : 'text-slate-500'}`}>{rankLabel(actualIndex)}</span>
                <span className={`hidden h-11 w-11 items-center justify-center rounded-full border text-sm font-black sm:flex ${isCurrentUser ? 'border-lime-300/30 bg-lime-300 text-slate-950' : 'border-white/10 bg-slate-900 text-slate-300'}`}>{initials(person.userName)}</span>
                <span className="min-w-0"><span className="flex items-center gap-2"><span className="block truncate font-black">{person.userName}</span>{isCurrentUser ? <span className="rounded-full bg-lime-300 px-2 py-0.5 text-[0.6rem] font-black uppercase tracking-wider text-slate-950">You</span> : null}</span><span className="block text-xs text-slate-500">{person.columnName}</span><span className="mt-2.5 block h-1.5 overflow-hidden rounded-full bg-white/5"><span className="block h-full rounded-full bg-gradient-to-r from-orange-500 via-orange-400 to-yellow-300 transition-[width] duration-700" style={{ width: `${Math.max(3, person[category] / max * 100)}%` }} /></span></span>
                <span className="rounded-xl bg-orange-400/10 px-3 py-2 text-right"><span className="block font-black text-orange-300">{person[category].toFixed(1)}</span><span className="block text-[0.6rem] font-bold uppercase tracking-wider text-slate-500">{category === 'totalPoints' ? 'points' : categories.find((item) => item.key === category)?.label}</span></span>
              </Link>;
            }) : <Empty />
          ) : teamResults.length ? teamResults.map((team) => {
            const actualIndex = teamRankMap.get(team.columnId) ?? 0;
            const max = rankedTeams[0]?.[teamMetric] || 1;
            return <div key={team.columnId} style={{ animationDelay: `${Math.min(actualIndex, 10) * 45}ms` }} className="standing-row-enter grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.035] px-3 py-3.5 sm:grid-cols-[auto_auto_1fr_auto] sm:gap-4 sm:px-5">
              <span className={`flex h-9 w-9 items-center justify-center rounded-xl text-sm font-black ${actualIndex < 3 ? 'bg-white/10' : 'text-slate-500'}`}>{rankLabel(actualIndex)}</span>
              <span className="hidden h-11 w-11 items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-300/10 text-sm font-black text-cyan-200 sm:flex">{initials(team.columnName)}</span>
              <span className="min-w-0"><span className="block truncate font-black">{team.columnName}</span><span className="block text-xs text-slate-500">{team.memberCount} members · {team.averagePoints.toFixed(1)} average</span><span className="mt-2.5 block h-1.5 overflow-hidden rounded-full bg-white/5"><span className="block h-full rounded-full bg-gradient-to-r from-sky-500 to-cyan-300 transition-[width] duration-700" style={{ width: `${Math.max(3, team[teamMetric] / max * 100)}%` }} /></span></span>
              <span className="rounded-xl bg-cyan-300/10 px-3 py-2 text-right"><span className="block font-black text-cyan-300">{team[teamMetric].toFixed(1)}</span><span className="block text-[0.6rem] font-bold uppercase tracking-wider text-slate-500">{teamMetric === 'averagePoints' ? 'avg pts' : 'points'}</span></span>
            </div>;
          }) : <Empty />}
        </div>
        </div>
        {currentUser && view === 'individual' ? <div className="fixed inset-x-3 bottom-4 z-40 mx-auto max-w-xl rounded-2xl border border-lime-300/30 bg-slate-900/95 p-3 shadow-2xl shadow-black/50 backdrop-blur-xl sm:p-4"><Link href={`/participants/${currentUser.userId}`} className="grid grid-cols-[auto_auto_1fr_auto] items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-lime-300 font-black text-slate-950">{currentUserIndex + 1}</span><span className="flex h-10 w-10 items-center justify-center rounded-full bg-lime-300/10 text-xs font-black text-lime-200">{initials(currentUser.userName)}</span><span className="min-w-0"><span className="block text-[0.6rem] font-black uppercase tracking-[0.18em] text-lime-300">Your position</span><span className="block truncate font-black">{currentUser.userName}</span></span><span className="text-right"><span className="block font-black text-orange-300">{currentUser[category].toFixed(1)}</span><span className="block text-[0.6rem] uppercase text-slate-500">points</span></span></Link></div> : null}
      </main>
    </div>
  );
}

function LoadingRows() {
  return <div className="space-y-2 p-4">{[1, 2, 3, 4, 5].map((row) => <div key={row} className="h-16 animate-pulse rounded-xl bg-white/5" />)}</div>;
}

function Empty() {
  return <div className="p-12 text-center text-slate-500">No results found for this view.</div>;
}
