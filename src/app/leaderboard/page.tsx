'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Activity, Bike, Footprints, RefreshCw, Search, Trophy, Users, Waves } from 'lucide-react';
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

const categories: { key: Category; label: string; icon: React.ReactNode }[] = [
  { key: 'totalPoints', label: 'Overall', icon: <Trophy /> },
  { key: 'runPoints', label: 'Run', icon: <Footprints /> },
  { key: 'cyclePoints', label: 'Cycle', icon: <Bike /> },
  { key: 'swimPoints', label: 'Swim', icon: <Waves /> },
  { key: 'hikePoints', label: 'Hike', icon: <Activity /> },
  { key: 'troopGamePoints', label: 'Troop games', icon: <Users /> },
];

export default function LeaderboardPage() {
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

  const individualResults = useMemo(() => individuals
    .filter((person) => `${person.userName} ${person.columnName}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => b[category] - a[category]), [individuals, category, query]);

  const teamResults = useMemo(() => teams
    .filter((team) => team.columnName.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => b[teamMetric] - a[teamMetric]), [teams, teamMetric, query]);

  const podium = view === 'individual' ? individualResults.slice(0, 3) : teamResults.slice(0, 3);

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
                <div className="grid min-h-64 grid-cols-3 items-end gap-2 sm:gap-3">
                  {podium.map((entry, index) => {
                    const isPerson = 'userId' in entry;
                    const score = isPerson ? entry[category] : entry[teamMetric];
                    const height = index === 0 ? 'h-48' : index === 1 ? 'h-40' : 'h-32';
                    const order = index === 0 ? 'order-2' : index === 1 ? 'order-1' : 'order-3';
                    const content = <>
                      <span className="text-2xl">{rankLabel(index)}</span>
                      <span className="mt-3 block max-w-full truncate text-sm font-black sm:text-base">{isPerson ? entry.userName : entry.columnName}</span>
                      <span className="mt-1 block truncate text-[0.65rem] text-slate-500 sm:text-xs">{isPerson ? entry.columnName : `${entry.memberCount} members`}</span>
                      <span className="mt-auto block text-lg font-black text-orange-300 sm:text-2xl">{score.toFixed(1)}</span>
                    </>;
                    const className = `hero-podium-bar ${height} ${order} flex min-w-0 flex-col rounded-t-2xl border p-3 text-center transition hover:-translate-y-1 sm:p-4 ${index === 0 ? 'border-lime-300/30 bg-gradient-to-t from-lime-300/10 to-yellow-300/15 [animation-delay:100ms]' : 'border-white/10 bg-white/[0.04]'} ${index === 2 ? '[animation-delay:200ms]' : ''}`;
                    return isPerson ? <Link key={entry.userId} href={`/participants/${entry.userId}`} className={className}>{content}</Link> : <div key={entry.columnId} className={className}>{content}</div>;
                  })}
                </div>
              ) : <div className="flex h-64 items-center justify-center text-sm text-slate-500">No scores yet. Be first on the podium.</div>}
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
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

        <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
          {loading ? <LoadingRows /> : view === 'individual' ? (
            individualResults.length ? individualResults.map((person, index) => {
              const max = individualResults[0]?.[category] || 1;
              return <Link key={person.userId} href={`/participants/${person.userId}`} className="grid w-full grid-cols-[3rem_1fr_auto] items-center gap-3 border-b border-white/5 px-4 py-4 text-left transition last:border-0 hover:bg-white/5 sm:grid-cols-[4rem_1fr_8rem_auto]">
                <span className="text-center text-lg font-black">{rankLabel(index)}</span>
                <span className="min-w-0"><span className="block truncate font-bold">{person.userName}</span><span className="block text-xs text-slate-500">{person.columnName}</span><span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-white/5"><span className="block h-full rounded-full bg-gradient-to-r from-orange-500 to-yellow-400" style={{ width: `${Math.max(3, person[category] / max * 100)}%` }} /></span></span>
                <span className="hidden text-right text-sm text-slate-500 sm:block">{category === 'totalPoints' ? 'Overall' : categories.find((item) => item.key === category)?.label}</span>
                <span className="font-black text-orange-300">{person[category].toFixed(1)} pts</span>
              </Link>;
            }) : <Empty />
          ) : teamResults.length ? teamResults.map((team, index) => {
            const max = teamResults[0]?.[teamMetric] || 1;
            return <div key={team.columnId} className="grid grid-cols-[3rem_1fr_auto] items-center gap-3 border-b border-white/5 px-4 py-4 last:border-0 sm:grid-cols-[4rem_1fr_8rem_auto]">
              <span className="text-center text-lg font-black">{rankLabel(index)}</span>
              <span className="min-w-0"><span className="block truncate font-bold">{team.columnName}</span><span className="block text-xs text-slate-500">{team.memberCount} members · {team.averagePoints.toFixed(1)} average</span><span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-white/5"><span className="block h-full rounded-full bg-gradient-to-r from-sky-500 to-cyan-300" style={{ width: `${Math.max(3, team[teamMetric] / max * 100)}%` }} /></span></span>
              <span className="hidden text-right text-sm text-slate-500 sm:block">{team.totalPoints.toFixed(1)} total</span>
              <span className="font-black text-sky-300">{team[teamMetric].toFixed(1)} {teamMetric === 'averagePoints' ? 'avg' : 'pts'}</span>
            </div>;
          }) : <Empty />}
        </div>
        </div>
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
