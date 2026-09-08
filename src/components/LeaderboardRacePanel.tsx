'use client';

import { useMemo, useState } from 'react';
import { Activity, Gauge, Minus, TrendingDown, TrendingUp, Users } from 'lucide-react';

type HistoryPoint = { date: string; rank: number; points: number };
type IndividualRaceEntry = {
  userId: string;
  userName: string;
  columnName: string;
  rank: number;
  totalPoints: number;
  history: HistoryPoint[];
};
type TeamRaceEntry = {
  columnId: string;
  columnName: string;
  rank: number;
  totalPoints: number;
  averagePoints: number;
  history: HistoryPoint[];
};

type Projection = {
  id: string;
  name: string;
  secondary: string;
  currentRank: number;
  projectedRank: number;
  currentPoints: number;
  weekGain: number;
  startRank: number | null;
  projectedPoints: number;
};

function singaporeDateParts() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Singapore', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const iso = `${value.year}-${value.month}-${value.day}`;
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(value.weekday);
  const date = new Date(`${iso}T00:00:00+08:00`);
  const start = new Date(date.getTime() - Math.max(0, weekday) * 86_400_000);
  return {
    today: iso,
    weekdayIndex: Math.max(0, weekday),
    weekStart: start.toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' }),
  };
}

function baseline(history: HistoryPoint[], weekStart: string) {
  return history.find((point) => point.date >= weekStart) ?? null;
}

function project(entries: Array<{ id: string; name: string; secondary: string; rank: number; totalPoints: number; history: HistoryPoint[] }>, weekStart: string, weekdayIndex: number) {
  const observedDays = Math.max(1, weekdayIndex + 1);
  const remainingDays = Math.max(0, 6 - weekdayIndex);
  const raw = entries.map((entry) => {
    const start = baseline(entry.history, weekStart);
    const startPoints = start?.points ?? entry.totalPoints;
    const weekGain = Math.max(0, entry.totalPoints - startPoints);
    const dailyPace = weekGain / observedDays;
    return {
      id: entry.id,
      name: entry.name,
      secondary: entry.secondary,
      currentRank: entry.rank,
      projectedRank: entry.rank,
      currentPoints: entry.totalPoints,
      weekGain,
      startRank: start?.rank ?? null,
      projectedPoints: entry.totalPoints + dailyPace * remainingDays,
    } satisfies Projection;
  });
  const ranked = [...raw].sort((a, b) => b.projectedPoints - a.projectedPoints || a.currentRank - b.currentRank);
  const rankById = new Map(ranked.map((entry, index) => [entry.id, index + 1]));
  return raw.map((entry) => ({ ...entry, projectedRank: rankById.get(entry.id) ?? entry.currentRank }));
}

function Movement({ from, to }: { from: number | null; to: number }) {
  if (from === null || from === to) return <span className="inline-flex items-center gap-1 text-slate-500"><Minus className="h-3 w-3" /> steady</span>;
  const change = from - to;
  return change > 0
    ? <span className="inline-flex items-center gap-1 text-emerald-300"><TrendingUp className="h-3 w-3" /> +{change}</span>
    : <span className="inline-flex items-center gap-1 text-rose-300"><TrendingDown className="h-3 w-3" /> {change}</span>;
}

export default function LeaderboardRacePanel({
  view,
  week,
  individuals,
  teams,
  category,
  teamMetric,
  currentUserId,
}: {
  view: 'individual' | 'team';
  week: string;
  individuals: IndividualRaceEntry[];
  teams: TeamRaceEntry[];
  category: string;
  teamMetric: string;
  currentUserId: string | null;
}) {
  const [compact, setCompact] = useState(true);
  const calendar = useMemo(() => singaporeDateParts(), []);
  const individualProjection = useMemo(() => project(individuals.map((entry) => ({
    id: entry.userId, name: entry.userName, secondary: entry.columnName, rank: entry.rank, totalPoints: entry.totalPoints, history: entry.history,
  })), calendar.weekStart, calendar.weekdayIndex), [individuals, calendar.weekStart, calendar.weekdayIndex]);
  const teamProjection = useMemo(() => project(teams.map((entry) => ({
    id: entry.columnId, name: entry.columnName, secondary: 'Column', rank: entry.rank, totalPoints: entry.totalPoints, history: entry.history,
  })), calendar.weekStart, calendar.weekdayIndex), [teams, calendar.weekStart, calendar.weekdayIndex]);

  const active = view === 'individual' ? individualProjection : teamProjection;
  const hasCurrentWeekHistory = active.some((entry) => entry.startRank !== null);
  const projected = [...active].sort((a, b) => a.projectedRank - b.projectedRank);
  const momentum = [...teamProjection].sort((a, b) => b.weekGain - a.weekGain || a.projectedRank - b.projectedRank).slice(0, 3);
  const currentUser = view === 'individual' && currentUserId ? individualProjection.find((entry) => entry.id === currentUserId) ?? null : null;
  const selectedIsOverall = view === 'individual' ? category === 'totalPoints' : teamMetric === 'totalPoints';

  return (
    <section className="mt-5 overflow-hidden rounded-2xl border border-lime-300/15 bg-gradient-to-br from-lime-300/[0.07] via-slate-950 to-cyan-300/[0.04] shadow-xl shadow-black/20">
      <div className="flex flex-col gap-4 border-b border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-lime-300"><Gauge className="h-4 w-4" /> Race view</p>
          <h2 className="mt-1 text-xl font-black">Momentum to Sunday</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">Uses saved daily ranking snapshots from this Singapore week. Projection is pace-based, not a guaranteed finish.</p>
        </div>
        <button type="button" onClick={() => setCompact((value) => !value)} className="min-h-10 rounded-xl border border-white/10 bg-white/5 px-4 text-xs font-black text-slate-300 transition hover:bg-white/10">
          {compact ? 'Detailed rows' : 'Compact rows'}
        </button>
      </div>

      {!selectedIsOverall ? <div className="border-b border-amber-300/10 bg-amber-300/[0.06] px-4 py-3 text-xs text-amber-100 sm:px-5">Race projections use overall points. Your sport/average filter still controls the main standings below.</div> : null}

      <div className="grid gap-px bg-white/10 sm:grid-cols-3">
        <div className="bg-slate-950/90 p-4 sm:p-5">
          <p className="text-[0.65rem] font-black uppercase tracking-wider text-slate-500">Since week start</p>
          <p className="mt-2 text-2xl font-black text-white">{hasCurrentWeekHistory ? `${Math.max(...active.map((entry) => entry.weekGain), 0).toFixed(1)} pts` : '—'}</p>
          <p className="mt-1 text-xs text-slate-500">Largest gain since {calendar.weekStart}</p>
        </div>
        <div className="bg-slate-950/90 p-4 sm:p-5">
          <p className="text-[0.65rem] font-black uppercase tracking-wider text-slate-500">Today vs week start</p>
          <p className="mt-2 text-2xl font-black text-white">{hasCurrentWeekHistory ? `${active.filter((entry) => entry.startRank !== null && entry.startRank !== entry.currentRank).length}` : '—'}</p>
          <p className="mt-1 text-xs text-slate-500">Positions currently changed</p>
        </div>
        <div className="bg-slate-950/90 p-4 sm:p-5">
          <p className="text-[0.65rem] font-black uppercase tracking-wider text-slate-500">Projection window</p>
          <p className="mt-2 text-2xl font-black text-white">{6 - calendar.weekdayIndex} days</p>
          <p className="mt-1 text-xs text-slate-500">Remaining until Sunday closes</p>
        </div>
      </div>

      <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[1.4fr_0.6fr]">
        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div><p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Projected Sunday order</p><p className="mt-1 text-xs text-slate-600">{week === 'all' ? 'All-time total at current weekly pace' : `Week ${week} pace projection`}</p></div>
            <Activity className="h-4 w-4 text-orange-300" />
          </div>
          {!hasCurrentWeekHistory ? <div className="rounded-xl border border-white/10 bg-black/20 p-5 text-sm text-slate-500">No snapshot from the current Singapore week is available for this selected period, so a projection would be misleading.</div> : (
            <div className="space-y-1.5">
              {projected.slice(0, compact ? 10 : 6).map((entry) => {
                const isCurrent = view === 'individual' && entry.id === currentUserId;
                return <div key={entry.id} className={`grid grid-cols-[2.25rem_1fr_auto] items-center gap-2 rounded-xl border px-2.5 ${compact ? 'py-2' : 'py-3'} ${isCurrent ? 'border-lime-300/25 bg-lime-300/[0.08]' : 'border-white/[0.06] bg-black/15'}`}>
                  <span className="text-center text-sm font-black text-slate-400">#{entry.projectedRank}</span>
                  <span className="min-w-0"><span className="flex items-center gap-2"><span className="truncate text-sm font-black">{entry.name}</span>{isCurrent ? <span className="rounded-full bg-lime-300 px-1.5 py-0.5 text-[0.55rem] font-black uppercase text-slate-950">You</span> : null}</span>{compact ? null : <span className="mt-0.5 block truncate text-[0.68rem] text-slate-500">{entry.secondary} · +{entry.weekGain.toFixed(1)} this week · <Movement from={entry.startRank} to={entry.currentRank} /></span>}</span>
                  <span className="text-right"><span className="block text-sm font-black text-orange-300">{entry.projectedPoints.toFixed(1)}</span><span className="block text-[0.58rem] uppercase text-slate-600">proj pts</span></span>
                </div>;
              })}
            </div>
          )}
          {currentUser && hasCurrentWeekHistory ? <div className="mt-3 rounded-xl border border-lime-300/20 bg-lime-300/[0.06] p-3 text-xs text-lime-100">At the current weekly pace, you project from <strong>#{currentUser.currentRank}</strong> now to <strong>#{currentUser.projectedRank}</strong> on Sunday, at about <strong>{currentUser.projectedPoints.toFixed(1)} points</strong>.</div> : null}
        </div>

        <aside>
          <div className="mb-3 flex items-center gap-2"><Users className="h-4 w-4 text-cyan-300" /><p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Column momentum</p></div>
          <div className="space-y-2">
            {momentum.map((entry, index) => <div key={entry.id} className="rounded-xl border border-cyan-300/10 bg-cyan-300/[0.04] p-3"><div className="flex items-center justify-between gap-3"><span className="truncate text-sm font-black">{index + 1}. {entry.name}</span><span className="text-sm font-black text-cyan-300">+{entry.weekGain.toFixed(1)}</span></div><div className="mt-1 flex items-center justify-between text-[0.68rem] text-slate-500"><span>week points</span><Movement from={entry.startRank} to={entry.currentRank} /></div></div>)}
            {!momentum.length ? <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-xs text-slate-500">Column momentum appears after ranking snapshots are available.</div> : null}
          </div>
        </aside>
      </div>
    </section>
  );
}
