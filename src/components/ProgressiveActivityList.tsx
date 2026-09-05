'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Activity, Bike, ExternalLink, Footprints, Trash2, Users, Waves } from 'lucide-react';
import { formatDistance, formatDuration, formatPace } from '@/lib/format';

const ActivityProof = dynamic(() => import('@/components/ActivityProof'), { loading: () => <div className="lg:col-span-4 h-20 animate-pulse rounded-xl bg-white/5" /> });
const ApprovedActivityDateEditor = dynamic(() => import('@/components/ApprovedActivityDateEditor'), { loading: () => null });
const PendingActivityEditor = dynamic(() => import('@/components/PendingActivityEditor'), { loading: () => null });

type ActivityCategory = 'RUN' | 'CYCLE' | 'SWIM' | 'WALK_OR_HIKE' | 'TROOP_GAMES';
export type DashboardActivity = {
  id: string;
  category: ActivityCategory;
  distance: number;
  pace: number | null;
  duration: number | null;
  points: number;
  completedWithFriend: boolean;
  companion: string | null;
  companionUserId: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason: string | null;
  proofUrl: string | null;
  occurredAt: string;
  stravaActivityId: string | null;
};

type SelectableUser = { id: string; name: string };
type ActivitySummary = { total: number; approved: number; pending: number };

const categoryIcons = { RUN: Footprints, CYCLE: Bike, SWIM: Waves, WALK_OR_HIKE: Activity, TROOP_GAMES: Users };
const categoryLabels = { RUN: 'Run', CYCLE: 'Cycle', SWIM: 'Swim', WALK_OR_HIKE: 'Walk / Hike', TROOP_GAMES: 'Troop Games' };

export default function ProgressiveActivityList({ initialActivities, users, profileId, summary }: { initialActivities: DashboardActivity[]; users: SelectableUser[]; profileId: string; summary: ActivitySummary }) {
  const router = useRouter();
  const [rows, setRows] = useState(initialActivities);
  const [stats, setStats] = useState(summary);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteMessage, setDeleteMessage] = useState('');
  const [editingCompanionId, setEditingCompanionId] = useState<string | null>(null);
  const [companionSelect, setCompanionSelect] = useState('');
  const [savingCompanion, setSavingCompanion] = useState(false);

  useEffect(() => {
    setRows(initialActivities);
    setStats(summary);
  }, [initialActivities, summary.approved, summary.pending, summary.total]);

  const loadMore = async () => {
    if (loadingMore || rows.length >= stats.total) return;
    setLoadingMore(true);
    setLoadError('');
    try {
      const response = await fetch(`/api/user/activities?offset=${rows.length}`, { cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !Array.isArray(data.activities)) throw new Error('Unable to load older activities.');
      setRows((current) => {
        const known = new Set(current.map((activity) => activity.id));
        return [...current, ...(data.activities as DashboardActivity[]).filter((activity) => !known.has(activity.id))];
      });
      if (typeof data.total === 'number') setStats((current) => ({ ...current, total: data.total }));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to load older activities.');
    } finally {
      setLoadingMore(false);
    }
  };

  const deleteSubmission = async (activity: DashboardActivity) => {
    const warning = activity.status === 'APPROVED' ? ` This removes ${activity.points.toFixed(1)} points from your score and your Column's total.` : '';
    const syncWarning = activity.stravaActivityId ? ' This does not delete it from Strava; syncing again may reimport it.' : '';
    if (!window.confirm(`Delete this ${categoryLabels[activity.category]} submission?${warning}${syncWarning} This cannot be undone.`)) return;
    setDeletingId(activity.id);
    setDeleteMessage('');
    try {
      const response = await fetch(`/api/activities/${activity.id}`, { method: 'DELETE' });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Could not delete submission.');
      setRows((current) => current.filter((row) => row.id !== activity.id));
      setStats((current) => ({
        total: Math.max(0, current.total - 1),
        approved: Math.max(0, current.approved - (activity.status === 'APPROVED' ? 1 : 0)),
        pending: Math.max(0, current.pending - (activity.status === 'PENDING' ? 1 : 0)),
      }));
      setDeleteMessage('Submission deleted. Your scores are being refreshed.');
      router.refresh();
    } catch (error) {
      setDeleteMessage(error instanceof Error ? error.message : 'Could not delete submission. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  const startEditCompanion = (activity: DashboardActivity) => {
    setEditingCompanionId(activity.id);
    setCompanionSelect(activity.companionUserId ?? '');
  };

  const saveCompanion = async (activityId: string) => {
    setSavingCompanion(true);
    try {
      const response = await fetch(`/api/activities/${activityId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companionUserId: companionSelect || null }),
      });
      if (response.ok) {
        setEditingCompanionId(null);
        router.refresh();
      }
    } finally {
      setSavingCompanion(false);
    }
  };

  return <details open className="dashboard-fold"><summary>My activities</summary><section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
    <div className="flex flex-wrap items-end justify-between gap-3 p-5 sm:p-6">
      <div className="flex items-start gap-3"><span className="rounded-xl bg-white/5 p-2.5"><Activity className="h-5 w-5 text-emerald-300" /></span><div><h2 className="text-lg font-black">My activities</h2><p className="mt-1 text-sm text-slate-500">Track approvals and manage your submissions</p></div></div>
      <span className="rounded-full bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-400">{stats.total} total</span>
    </div>
    <p role="status" aria-live="polite" className="px-5 text-sm text-slate-300 sm:px-6">{deleteMessage}</p>
    {rows.length ? <div>{rows.map((activity) => {
      const Icon = categoryIcons[activity.category];
      return <div id={`activity-${activity.id}`} key={activity.id} className="grid scroll-mt-24 gap-4 border-t border-white/5 px-5 py-4 sm:px-6 lg:grid-cols-[auto_1fr_auto_auto] lg:items-center">
        <span className="hidden rounded-xl bg-white/5 p-2.5 text-slate-300 lg:block"><Icon className="h-5 w-5" /></span>
        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-bold">{categoryLabels[activity.category]}</p><Status status={activity.status} /></div><p className="mt-1 text-xs text-slate-500">{new Date(activity.occurredAt).toLocaleDateString('en-SG', { timeZone: 'Asia/Singapore', day: 'numeric', month: 'short', year: 'numeric' })}{activity.distance ? ` · ${formatDistance(activity.distance)}${activity.category === 'SWIM' ? 'm' : 'km'}` : ''}{activity.duration ? ` · ${formatDuration(activity.duration)}` : ''}{activity.pace ? ` · ${formatPace(activity.pace)}/km` : ''}</p>{activity.rejectionReason ? <p className="mt-2 text-xs text-rose-300">Reason: {activity.rejectionReason}</p> : null}</div>
        <div className="text-sm text-slate-400">{editingCompanionId === activity.id ? <div className="flex flex-wrap items-center gap-2"><select aria-label="Select activity companion" value={companionSelect} onChange={(event) => setCompanionSelect(event.target.value)} className="rounded-lg border border-white/10 bg-slate-900 px-2 py-1.5 text-xs text-white"><option value="">No friend</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select><button type="button" onClick={() => saveCompanion(activity.id)} disabled={savingCompanion} className="text-xs font-bold text-sky-300 disabled:opacity-50">Save</button><button type="button" onClick={() => setEditingCompanionId(null)} className="text-xs text-slate-500">Cancel</button></div> : <div className="flex items-center gap-2"><span>{activity.completedWithFriend ? `With ${activity.companion || 'a friend'}` : 'Solo activity'}</span>{activity.status === 'PENDING' && activity.stravaActivityId ? <button type="button" onClick={() => startEditCompanion(activity)} className="text-xs font-bold text-sky-300">Edit</button> : null}</div>}</div>
        <div className="flex items-center justify-between gap-5 lg:justify-end">{activity.stravaActivityId ? <a href={`https://www.strava.com/activities/${activity.stravaActivityId}`} target="_blank" rel="noopener noreferrer" aria-label="View activity on Strava" className="text-orange-400 transition hover:text-orange-300"><ExternalLink className="h-4 w-4" /></a> : <span />}<button type="button" disabled={deletingId !== null} onClick={() => void deleteSubmission(activity)} className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-rose-300 hover:bg-rose-400/10 disabled:opacity-50"><Trash2 className="h-4 w-4" />{deletingId === activity.id ? 'Deleting…' : 'Delete'}</button><span className="min-w-16 text-right font-black text-orange-300">+{activity.points.toFixed(1)}</span></div>
        <ActivityProof proofUrl={activity.proofUrl} label={`${categoryLabels[activity.category]} activity screenshot`} />
        {activity.status === 'APPROVED' ? <ApprovedActivityDateEditor activity={activity} /> : null}
        {activity.status === 'PENDING' ? <PendingActivityEditor activity={activity} users={users.filter((user) => user.id !== profileId)} /> : null}
      </div>;
    })}</div> : <div className="p-10 text-center text-sm text-slate-500">No activities yet. Log your first activity to begin.</div>}
    {loadError ? <p role="alert" className="border-t border-white/5 px-5 py-3 text-sm text-rose-300 sm:px-6">{loadError}</p> : null}
    {rows.length < stats.total ? <div className="border-t border-white/5 p-4 text-center"><button type="button" onClick={() => void loadMore()} disabled={loadingMore} className="rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-black text-slate-200 transition hover:bg-white/10 disabled:opacity-50">{loadingMore ? 'Loading…' : `Load more · ${stats.total - rows.length} remaining`}</button></div> : null}
  </section></details>;
}

function Status({ status }: { status: DashboardActivity['status'] }) {
  const styles = status === 'APPROVED' ? 'bg-emerald-400/10 text-emerald-300' : status === 'REJECTED' ? 'bg-rose-400/10 text-rose-300' : 'bg-yellow-400/10 text-yellow-300';
  return <span className={`rounded-full px-2.5 py-1 text-[0.65rem] font-black tracking-wide ${styles}`}>{status}</span>;
}
