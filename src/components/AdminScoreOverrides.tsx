'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Eye, ImageOff, RotateCcw, Save, Search, SlidersHorizontal, X } from 'lucide-react';
import { proofDisplayHref } from '@/lib/proof-reference';

type ActivityStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
type ScoreActivity = {
  id: string;
  category: string;
  status: ActivityStatus;
  occurredAt: string;
  points: number;
  proofUrl: string | null;
  basePointsOverride: number | null;
  totalPointsOverride: number | null;
  pointsLog: { basePoints: number; friendBonus: number; totalPoints: number } | null;
  user: { id: string; name: string; email: string };
  column: { name: string };
};

type EditState = {
  id: string;
  baseEnabled: boolean;
  totalEnabled: boolean;
  base: string;
  total: string;
};

export default function AdminScoreOverrides({ initialActivities }: { initialActivities: ScoreActivity[] }) {
  const [activities, setActivities] = useState(initialActivities);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'ALL' | ActivityStatus>('APPROVED');
  const [edit, setEdit] = useState<EditState | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [selectedProof, setSelectedProof] = useState<string | null>(null);
  const [error, setError] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return activities
      .filter((activity) => status === 'ALL' || activity.status === status)
      .filter((activity) => !q || `${activity.user.name} ${activity.user.email} ${activity.column.name} ${activity.category}`.toLowerCase().includes(q))
      .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
  }, [activities, query, status]);

  const refresh = async () => {
    const response = await fetch('/api/admin/activities?status=ALL', { cache: 'no-store' });
    const data = await response.json().catch(() => null);
    if (!response.ok || !Array.isArray(data)) throw new Error('Latest scores could not be loaded.');
    setActivities(data as ScoreActivity[]);
  };

  const start = (activity: ScoreActivity) => {
    if (!activity.pointsLog) return;
    setError('');
    setEdit({
      id: activity.id,
      baseEnabled: activity.basePointsOverride !== null,
      totalEnabled: activity.totalPointsOverride !== null,
      base: String(activity.basePointsOverride ?? activity.pointsLog.basePoints),
      total: String(activity.totalPointsOverride ?? activity.pointsLog.totalPoints),
    });
  };

  const save = async (activity: ScoreActivity) => {
    if (!edit || edit.id !== activity.id) return;
    const base = Number(edit.base);
    const total = Number(edit.total);
    if (edit.baseEnabled && (!Number.isFinite(base) || base < 0)) return setError('Base points must be zero or greater.');
    if (edit.totalEnabled && (!Number.isFinite(total) || total < 0 || Math.abs(total * 2 - Math.round(total * 2)) > 1e-9)) {
      return setError('Total points must be zero or greater and use 0.5-point increments.');
    }
    setSavingId(activity.id);
    setError('');
    try {
      const response = await fetch(`/api/admin/activities/${activity.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          basePointsOverride: edit.baseEnabled ? base : null,
          totalPointsOverride: edit.totalEnabled ? total : null,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Failed to save score override.');
      await refresh();
      setEdit(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save score override.');
    } finally {
      setSavingId(null);
    }
  };

  const clear = async (activity: ScoreActivity) => {
    setSavingId(activity.id);
    setError('');
    try {
      const response = await fetch(`/api/admin/activities/${activity.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ basePointsOverride: null, totalPointsOverride: null }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Failed to clear score override.');
      await refresh();
      setEdit(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear score override.');
    } finally {
      setSavingId(null);
    }
  };

  return <div className="space-y-5">
    <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <label className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search athlete, email, column or sport" className="w-full rounded-xl border border-white/10 bg-slate-900 py-2.5 pl-9 pr-4 text-sm outline-none focus:border-orange-400" /></label>
        <select aria-label="Filter score overrides by status" value={status} onChange={(event) => setStatus(event.target.value as 'ALL' | ActivityStatus)} className="rounded-xl border border-white/10 bg-slate-900 px-4 py-2.5 text-sm outline-none focus:border-orange-400">
          <option value="APPROVED">Approved</option><option value="PENDING">Pending</option><option value="REJECTED">Rejected</option><option value="ALL">All</option>
        </select>
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500">Proof stays behind the authenticated proof viewer. Base override replaces the calculated base points. Friend-bonus allocation stays automatic. A Total override, when enabled, becomes the exact final saved total and must use 0.5-point increments.</p>
    </section>

    {error ? <div role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-200">{error}</div> : null}

    <section className="space-y-3">
      {filtered.map((activity) => {
        const log = activity.pointsLog;
        const isEditing = edit?.id === activity.id;
        const overridden = activity.basePointsOverride !== null || activity.totalPointsOverride !== null;
        return <article key={activity.id} data-score-activity-id={activity.id} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
          <div className="grid sm:grid-cols-[10rem_1fr]">
            <div className="relative min-h-36 overflow-hidden border-b border-white/10 bg-black/20 sm:min-h-full sm:border-b-0 sm:border-r">
              {activity.proofUrl ? <button type="button" onClick={() => setSelectedProof(activity.proofUrl)} aria-label={`View ${activity.user.name}'s proof`} className="group relative h-full min-h-36 w-full">
                <Image src={proofDisplayHref(activity.proofUrl)!} alt={`${activity.user.name} activity proof`} fill unoptimized sizes="(max-width: 640px) 100vw, 160px" className="object-cover transition duration-300 group-hover:scale-105" />
                <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-lg bg-black/75 px-2 py-1 text-[0.68rem] font-bold text-white"><Eye className="h-3.5 w-3.5" />View proof</span>
              </button> : <div className="flex h-full min-h-36 flex-col items-center justify-center gap-2 px-4 text-center text-slate-600"><ImageOff className="h-6 w-6" /><span className="text-xs font-bold">No photo proof</span></div>}
            </div>

            <div className="p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div><div className="flex flex-wrap items-center gap-2"><Link href={`/participants/${activity.user.id}`} className="font-black hover:text-orange-300">{activity.user.name}</Link><span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[0.68rem] font-black text-slate-400">{activity.status}</span>{overridden ? <span className="rounded-full border border-orange-400/20 bg-orange-400/10 px-2 py-0.5 text-[0.68rem] font-black text-orange-200">ADMIN OVERRIDE</span> : null}</div><p className="mt-1 text-xs text-slate-500">{activity.column.name} · {activity.category} · {new Date(activity.occurredAt).toLocaleDateString('en-SG', { timeZone: 'Asia/Singapore', day: 'numeric', month: 'short', year: 'numeric' })}</p></div>
                <div className="text-right"><p className="text-2xl font-black text-orange-300">{activity.points.toFixed(1)}</p><p className="text-[0.68rem] uppercase tracking-wider text-slate-600">saved total</p></div>
              </div>

              {log ? <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl border border-white/5 bg-black/10 p-3 text-center text-xs"><div><p className="text-slate-500">Base</p><p className="mt-1 font-black">{log.basePoints.toFixed(2)}</p></div><div><p className="text-slate-500">Friend</p><p className="mt-1 font-black">+{log.friendBonus.toFixed(1)}</p></div><div><p className="text-slate-500">Total</p><p className="mt-1 font-black">{log.totalPoints.toFixed(1)}</p></div></div> : <p className="mt-4 text-sm text-amber-200">Score breakdown unavailable for this activity.</p>}

              {isEditing && log ? <div className="mt-4 grid gap-4 rounded-xl border border-orange-400/20 bg-orange-400/[0.06] p-4 md:grid-cols-2">
                <label className="space-y-2"><span className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={edit.baseEnabled} onChange={(event) => setEdit({ ...edit, baseEnabled: event.target.checked })} />Override Base Points</span><input aria-label="Base Points override" type="number" min="0" step="0.01" disabled={!edit.baseEnabled} value={edit.base} onChange={(event) => setEdit({ ...edit, base: event.target.value })} className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 disabled:opacity-50" /></label>
                <label className="space-y-2"><span className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={edit.totalEnabled} onChange={(event) => setEdit({ ...edit, totalEnabled: event.target.checked })} />Override Points Total</span><input aria-label="Points Total override" type="number" min="0" step="0.5" disabled={!edit.totalEnabled} value={edit.total} onChange={(event) => setEdit({ ...edit, total: event.target.value })} className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 disabled:opacity-50" /></label>
                <div className="flex flex-wrap gap-2 md:col-span-2"><button type="button" disabled={savingId === activity.id} onClick={() => save(activity)} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-black disabled:opacity-50"><Save className="h-4 w-4" />Save score</button><button type="button" disabled={savingId === activity.id} onClick={() => clear(activity)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold disabled:opacity-50"><RotateCcw className="h-4 w-4" />Use calculated score</button><button type="button" onClick={() => setEdit(null)} className="min-h-10 rounded-xl px-4 py-2 text-sm font-bold text-slate-400">Cancel</button></div>
              </div> : <div className="mt-4 flex flex-wrap items-center gap-3"><button type="button" disabled={!log || savingId !== null} onClick={() => start(activity)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-orange-400/20 bg-orange-400/10 px-4 py-2 text-sm font-black text-orange-200 disabled:opacity-50"><SlidersHorizontal className="h-4 w-4" />Edit score</button>{overridden ? <button type="button" disabled={savingId !== null} onClick={() => clear(activity)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold disabled:opacity-50"><RotateCcw className="h-4 w-4" />Clear overrides</button> : null}</div>}
            </div>
          </div>
        </article>;
      })}
      {!filtered.length ? <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-slate-500">No matching activities.</div> : null}
    </section>

    {selectedProof ? <div role="dialog" aria-modal="true" aria-label="Activity proof preview" className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={() => setSelectedProof(null)}>
      <button type="button" onClick={() => setSelectedProof(null)} aria-label="Close proof preview" className="absolute right-5 top-5 z-10 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"><X className="h-5 w-5" /></button>
      <div className="relative h-full w-full"><Image src={proofDisplayHref(selectedProof)!} alt="Activity proof enlarged" fill unoptimized sizes="100vw" className="object-contain" /></div>
    </div> : null}
  </div>;
}
