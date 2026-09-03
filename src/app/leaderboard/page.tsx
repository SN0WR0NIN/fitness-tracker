'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Bike, Footprints, RefreshCw, Search, Trophy, Users, Waves } from 'lucide-react';
import Navbar from '@/components/Navbar';
import UserActivitiesModal from '@/components/UserActivitiesModal';

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
  const [selectedUser, setSelectedUser] = useState<IndividualLeader | null>(null);

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
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-orange-400">Live competition</p>
            <h1 className="mt-2 text-4xl font-black sm:text-5xl">Leaderboard</h1>
            <p className="mt-3 text-slate-400">Explore every ranking and see who is setting the pace.</p>
          </div>
          <button onClick={() => loadLeaderboard(true)} disabled={refreshing} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-300 transition hover:bg-white/10 disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            {updatedAt ? `Updated ${updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Refresh'}
          </button>
        </div>

        {!loading && podium.length > 0 && (
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {podium.map((entry, index) => {
              const isPerson = 'userId' in entry;
              const score = isPerson ? entry[category] : entry[teamMetric];
              return (
                <button key={isPerson ? entry.userId : entry.columnId} onClick={() => isPerson && setSelectedUser(entry)} className={`rounded-2xl border p-5 text-left transition hover:-translate-y-1 ${index === 0 ? 'border-yellow-400/30 bg-yellow-400/10 sm:order-2' : 'border-white/10 bg-white/[0.04]'} ${index === 1 ? 'sm:order-1' : index === 2 ? 'sm:order-3' : ''}`}>
                  <span className="text-3xl">{rankLabel(index)}</span>
                  <p className="mt-4 truncate text-lg font-black">{isPerson ? entry.userName : entry.columnName}</p>
                  <p className="text-sm text-slate-400">{isPerson ? entry.columnName : `${entry.memberCount} members`}</p>
                  <p className="mt-4 text-2xl font-black text-orange-300">{score.toFixed(1)} <span className="text-xs font-medium text-slate-500">{!isPerson && teamMetric === 'averagePoints' ? 'avg pts' : 'pts'}</span></p>
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
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
              return <button key={person.userId} onClick={() => setSelectedUser(person)} className="grid w-full grid-cols-[3rem_1fr_auto] items-center gap-3 border-b border-white/5 px-4 py-4 text-left transition last:border-0 hover:bg-white/5 sm:grid-cols-[4rem_1fr_8rem_auto]">
                <span className="text-center text-lg font-black">{rankLabel(index)}</span>
                <span className="min-w-0"><span className="block truncate font-bold">{person.userName}</span><span className="block text-xs text-slate-500">{person.columnName}</span><span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-white/5"><span className="block h-full rounded-full bg-gradient-to-r from-orange-500 to-yellow-400" style={{ width: `${Math.max(3, person[category] / max * 100)}%` }} /></span></span>
                <span className="hidden text-right text-sm text-slate-500 sm:block">{category === 'totalPoints' ? 'Overall' : categories.find((item) => item.key === category)?.label}</span>
                <span className="font-black text-orange-300">{person[category].toFixed(1)} pts</span>
              </button>;
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
      </main>
      {selectedUser && <UserActivitiesModal userId={selectedUser.userId} userName={selectedUser.userName} onClose={() => setSelectedUser(null)} />}
    </div>
  );
}

function LoadingRows() {
  return <div className="space-y-2 p-4">{[1, 2, 3, 4, 5].map((row) => <div key={row} className="h-16 animate-pulse rounded-xl bg-white/5" />)}</div>;
}

function Empty() {
  return <div className="p-12 text-center text-slate-500">No results found for this view.</div>;
}
