'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  ExternalLink,
  Eye,
  Pencil,
  RotateCcw,
  Search,
  ShieldCheck,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import { formatDistance, formatDuration, formatPace } from '@/lib/format';

type ActivityCategory = 'RUN' | 'CYCLE' | 'SWIM' | 'WALK_OR_HIKE' | 'TROOP_GAMES';
type ActivityStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
type StatusFilter = 'ALL' | ActivityStatus;

type ReviewActivity = {
  id: string;
  category: ActivityCategory;
  distance: number;
  pace: number | null;
  duration: number | null;
  elevationGain: number | null;
  points: number;
  completedWithFriend: boolean;
  companion: string | null;
  companionUserId: string | null;
  proofUrl: string | null;
  stravaActivityId: string | null;
  status: ActivityStatus;
  occurredAt: string;
  createdAt: string;
  reviewedAt: string | null;
  rejectionReason: string | null;
  user: { id: string; name: string; email: string };
  column: { id: string; name: string };
  reviewedBy: { id: string; name: string } | null;
};

type SelectableUser = { id: string; name: string };

const categories: Array<{ value: ActivityCategory | 'ALL'; label: string }> = [
  { value: 'ALL', label: 'All activities' },
  { value: 'RUN', label: 'Run' },
  { value: 'CYCLE', label: 'Cycle' },
  { value: 'SWIM', label: 'Swim' },
  { value: 'WALK_OR_HIKE', label: 'Walk / Hike' },
  { value: 'TROOP_GAMES', label: 'Troop Games' },
];

const categoryLabels: Record<ActivityCategory, string> = {
  RUN: 'Run',
  CYCLE: 'Cycle',
  SWIM: 'Swim',
  WALK_OR_HIKE: 'Walk / Hike',
  TROOP_GAMES: 'Troop Games',
};

export default function AdminActivityReview({ initialActivities, users }: { initialActivities: ReviewActivity[]; users: SelectableUser[] }) {
  const [activities, setActivities] = useState(initialActivities);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('PENDING');
  const [categoryFilter, setCategoryFilter] = useState<ActivityCategory | 'ALL'>('ALL');
  const [query, setQuery] = useState('');
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedProof, setSelectedProof] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [editForm, setEditForm] = useState({ category: 'RUN' as ActivityCategory, distance: '', pace: '', companionSelect: '', companionName: '' });

  const counts = useMemo(() => ({
    ALL: activities.length,
    PENDING: activities.filter((activity) => activity.status === 'PENDING').length,
    APPROVED: activities.filter((activity) => activity.status === 'APPROVED').length,
    REJECTED: activities.filter((activity) => activity.status === 'REJECTED').length,
  }), [activities]);

  const filteredActivities = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return activities
      .filter((activity) => statusFilter === 'ALL' || activity.status === statusFilter)
      .filter((activity) => categoryFilter === 'ALL' || activity.category === categoryFilter)
      .filter((activity) => !normalizedQuery || `${activity.user.name} ${activity.user.email} ${activity.column.name}`.toLowerCase().includes(normalizedQuery))
      .sort((a, b) => {
        if (statusFilter === 'PENDING') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [activities, statusFilter, categoryFilter, query]);

  const runStatusAction = async (activityId: string, action: 'approve' | 'reject' | 'reset', reason?: string) => {
    setActioningId(activityId);
    setActionError('');
    try {
      const response = await fetch(`/api/admin/activities/${activityId}/${action}`, {
        method: 'POST',
        headers: action === 'reject' ? { 'Content-Type': 'application/json' } : undefined,
        body: action === 'reject' ? JSON.stringify({ reason }) : undefined,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : `Failed to ${action} activity.`);
      setActivities((current) => current.map((activity) => activity.id === activityId ? {
        ...activity,
        status: data.status,
        reviewedAt: data.reviewedAt ?? null,
        rejectionReason: data.rejectionReason ?? null,
      } : activity));
      setRejectingId(null);
      setRejectionReason('');
    } catch (error) {
      setActionError(error instanceof Error ? error.message : `Failed to ${action} activity.`);
    } finally {
      setActioningId(null);
    }
  };

  const startEdit = (activity: ReviewActivity) => {
    setEditingId(activity.id);
    setEditForm({
      category: activity.category,
      distance: activity.distance?.toString() ?? '',
      pace: activity.pace?.toString() ?? '',
      companionSelect: activity.companionUserId ?? (activity.completedWithFriend ? '__manual__' : ''),
      companionName: activity.companionUserId ? '' : activity.companion ?? '',
    });
  };

  const saveEdit = async (activity: ReviewActivity) => {
    setActioningId(activity.id);
    setActionError('');
    try {
      const body: Record<string, unknown> = {
        category: editForm.category,
        distance: editForm.category === 'TROOP_GAMES' ? undefined : Number(editForm.distance),
        pace: editForm.category === 'RUN' && editForm.pace ? Number(editForm.pace) : undefined,
      };
      if (editForm.companionSelect === '__manual__') body.companionName = editForm.companionName.trim() || null;
      else body.companionUserId = editForm.companionSelect || null;

      const response = await fetch(`/api/admin/activities/${activity.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Failed to update activity.');
      setActivities((current) => current.map((item) => item.id === activity.id ? { ...item, ...data } : item));
      setEditingId(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to update activity.');
    } finally {
      setActioningId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <header className="rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.25),_transparent_45%),rgba(255,255,255,0.04)] p-6 sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div><p className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.2em] text-sky-300"><ShieldCheck className="h-4 w-4" />Admin control</p><h1 className="mt-2 text-3xl font-black sm:text-5xl">Activity review</h1><p className="mt-3 max-w-2xl text-slate-400">Check evidence, correct activity details, and keep the competition standings accurate.</p></div>
            <div className="rounded-2xl border border-yellow-400/20 bg-yellow-400/10 px-5 py-4"><p className="text-xs text-yellow-200">Waiting for review</p><p className="mt-1 text-3xl font-black text-yellow-300">{counts.PENDING}</p></div>
          </div>
        </header>

        <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {(['PENDING', 'APPROVED', 'REJECTED', 'ALL'] as StatusFilter[]).map((status) => <button key={status} type="button" onClick={() => setStatusFilter(status)} className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-bold transition ${statusFilter === status ? 'bg-orange-500 text-white' : 'bg-black/20 text-slate-400 hover:bg-white/5 hover:text-white'}`}>{status === 'ALL' ? 'All' : status.charAt(0) + status.slice(1).toLowerCase()} <span className="ml-1 opacity-70">{counts[status]}</span></button>)}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <label className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search athlete or column" className="w-full rounded-xl border border-white/10 bg-slate-900 py-2.5 pl-9 pr-4 text-sm outline-none placeholder:text-slate-600 focus:border-orange-400 sm:w-64" /></label>
              <select aria-label="Filter by activity type" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value as ActivityCategory | 'ALL')} className="rounded-xl border border-white/10 bg-slate-900 px-4 py-2.5 text-sm outline-none focus:border-orange-400">{categories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</select>
            </div>
          </div>
        </section>

        {actionError ? <div role="alert" className="mt-5 rounded-xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-200">{actionError}</div> : null}

        <section className="mt-5 space-y-4">
          {filteredActivities.length ? filteredActivities.map((activity) => (
            <article key={activity.id} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
              <div className="grid lg:grid-cols-[14rem_1fr]">
                <div className="relative flex min-h-48 items-center justify-center overflow-hidden bg-black/20 lg:min-h-full">
                  {activity.proofUrl ? <button type="button" onClick={() => setSelectedProof(activity.proofUrl)} aria-label={`Enlarge ${activity.user.name}'s proof`} className="group relative h-full min-h-48 w-full"><Image src={activity.proofUrl} alt={`${activity.user.name}'s activity proof`} fill unoptimized sizes="(max-width: 1024px) 100vw, 224px" className="object-cover transition duration-500 group-hover:scale-105" /><span className="absolute bottom-3 right-3 rounded-lg bg-black/70 p-2 text-white"><Eye className="h-4 w-4" /></span></button> : activity.stravaActivityId ? <div className="text-center text-orange-300"><ExternalLink className="mx-auto h-8 w-8" /><p className="mt-2 text-xs font-bold">Strava activity</p></div> : <div className="text-center text-slate-600"><Activity className="mx-auto h-8 w-8" /><p className="mt-2 text-xs">No proof attached</p></div>}
                </div>
                <div className="p-5 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div><div className="flex flex-wrap items-center gap-2"><Link href={`/participants/${activity.user.id}`} className="text-lg font-black transition hover:text-orange-300">{activity.user.name}</Link><StatusPill status={activity.status} /></div><p className="mt-1 text-sm text-slate-500">{activity.column.name} · {new Date(activity.occurredAt).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}</p></div>
                    <div className="text-right"><p className="text-3xl font-black text-orange-300">{activity.points.toFixed(1)}</p><p className="text-xs text-slate-500">points</p></div>
                  </div>

                  {editingId === activity.id ? <EditPanel activity={activity} users={users} editForm={editForm} setEditForm={setEditForm} save={() => saveEdit(activity)} cancel={() => setEditingId(null)} saving={actioningId === activity.id} /> : (
                    <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
                      <Detail label="Activity" value={categoryLabels[activity.category]} />
                      <Detail label="Distance" value={activity.distance ? `${formatDistance(activity.distance)}${activity.category === 'SWIM' ? 'm' : 'km'}` : 'Not required'} />
                      <Detail label="Pace / duration" value={[activity.pace ? `${formatPace(activity.pace)}/km` : null, activity.duration ? formatDuration(activity.duration) : null].filter(Boolean).join(' · ') || 'Not provided'} />
                      <Detail label="Companion" value={activity.completedWithFriend ? activity.companion || 'Friend recorded' : 'Solo activity'} />
                    </div>
                  )}

                  {activity.rejectionReason ? <div className="mt-4 rounded-xl border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-200"><strong>Rejection reason:</strong> {activity.rejectionReason}</div> : null}
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5">
                    <div className="flex flex-wrap gap-3 text-xs">
                      {activity.stravaActivityId ? <a href={`https://www.strava.com/activities/${activity.stravaActivityId}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-bold text-orange-300 hover:underline"><ExternalLink className="h-3.5 w-3.5" />Open Strava</a> : null}
                      {editingId !== activity.id ? <button type="button" onClick={() => startEdit(activity)} className="inline-flex items-center gap-1 font-bold text-slate-400 transition hover:text-white"><Pencil className="h-3.5 w-3.5" />Correct details</button> : null}
                      {activity.reviewedBy ? <span className="text-slate-600">Reviewed by {activity.reviewedBy.name}</span> : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {activity.status !== 'APPROVED' ? <button type="button" onClick={() => runStatusAction(activity.id, 'approve')} disabled={actioningId === activity.id} className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"><CheckCircle2 className="h-4 w-4" />Approve</button> : null}
                      {activity.status !== 'REJECTED' ? <button type="button" onClick={() => { setRejectingId(activity.id); setRejectionReason(''); }} disabled={actioningId === activity.id} className="inline-flex items-center gap-2 rounded-xl bg-rose-500 px-4 py-2 text-sm font-bold transition hover:bg-rose-400 disabled:opacity-50"><XCircle className="h-4 w-4" />Reject</button> : null}
                      {activity.status !== 'PENDING' ? <button type="button" onClick={() => runStatusAction(activity.id, 'reset')} disabled={actioningId === activity.id} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm font-bold text-slate-300 transition hover:bg-white/5 disabled:opacity-50"><RotateCcw className="h-4 w-4" />Reset</button> : null}
                    </div>
                  </div>
                </div>
              </div>
            </article>
          )) : <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-14 text-center"><Users className="mx-auto h-10 w-10 text-slate-700" /><p className="mt-4 font-bold text-slate-300">No matching activities</p><p className="mt-2 text-sm text-slate-500">Try another status, category, or search term.</p></div>}
        </section>
      </main>

      {selectedProof ? <div role="dialog" aria-modal="true" aria-label="Activity proof preview" className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={() => setSelectedProof(null)}><button type="button" onClick={() => setSelectedProof(null)} aria-label="Close proof preview" className="absolute right-5 top-5 z-10 rounded-full bg-white/10 p-2 text-white"><X className="h-5 w-5" /></button><div className="relative h-full w-full"><Image src={selectedProof} alt="Activity proof enlarged" fill unoptimized sizes="100vw" className="object-contain" /></div></div> : null}

      {rejectingId ? <div role="dialog" aria-modal="true" aria-labelledby="reject-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"><div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><h2 id="reject-title" className="text-xl font-black">Reject activity</h2><p className="mt-2 text-sm text-slate-400">Explain what the participant should correct before resubmitting.</p></div><button type="button" onClick={() => setRejectingId(null)} aria-label="Close rejection dialog" className="rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-white"><X className="h-5 w-5" /></button></div><label className="mt-5 block"><span className="text-sm font-bold text-slate-300">Reason</span><textarea value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} maxLength={300} rows={4} autoFocus placeholder="Example: The screenshot does not show the activity distance." className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-slate-950 p-3 text-sm outline-none placeholder:text-slate-600 focus:border-rose-400" /><span className="mt-1 block text-right text-xs text-slate-600">{rejectionReason.length}/300</span></label><div className="mt-5 flex justify-end gap-3"><button type="button" onClick={() => setRejectingId(null)} className="rounded-xl border border-white/10 px-4 py-2 text-sm font-bold text-slate-300">Cancel</button><button type="button" onClick={() => runStatusAction(rejectingId, 'reject', rejectionReason.trim())} disabled={rejectionReason.trim().length < 3 || actioningId === rejectingId} className="rounded-xl bg-rose-500 px-4 py-2 text-sm font-bold transition hover:bg-rose-400 disabled:opacity-40">{actioningId === rejectingId ? 'Rejecting…' : 'Confirm rejection'}</button></div></div></div> : null}
    </div>
  );
}

function EditPanel({ activity, users, editForm, setEditForm, save, cancel, saving }: { activity: ReviewActivity; users: SelectableUser[]; editForm: { category: ActivityCategory; distance: string; pace: string; companionSelect: string; companionName: string }; setEditForm: React.Dispatch<React.SetStateAction<{ category: ActivityCategory; distance: string; pace: string; companionSelect: string; companionName: string }>>; save: () => void; cancel: () => void; saving: boolean }) {
  return <div className="mt-5 rounded-2xl border border-sky-400/20 bg-sky-400/5 p-4"><p className="mb-4 text-sm font-black text-sky-200">Correct activity details</p><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><label className="text-xs text-slate-500">Activity<select value={editForm.category} onChange={(event) => setEditForm((current) => ({ ...current, category: event.target.value as ActivityCategory }))} className="mt-1 block w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white">{categories.filter((category) => category.value !== 'ALL').map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</select></label><label className="text-xs text-slate-500">Distance<input type="number" min="0" step="0.01" value={editForm.distance} disabled={editForm.category === 'TROOP_GAMES'} onChange={(event) => setEditForm((current) => ({ ...current, distance: event.target.value }))} className="mt-1 block w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-40" /></label><label className="text-xs text-slate-500">Pace (decimal)<input type="number" min="0" step="0.01" value={editForm.pace} disabled={editForm.category !== 'RUN'} onChange={(event) => setEditForm((current) => ({ ...current, pace: event.target.value }))} className="mt-1 block w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-40" /></label><label className="text-xs text-slate-500">Companion<select value={editForm.companionSelect} onChange={(event) => setEditForm((current) => ({ ...current, companionSelect: event.target.value }))} className="mt-1 block w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white"><option value="">No companion</option><option value="__manual__">Friend not registered</option>{users.filter((user) => user.id !== activity.user.id).map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label></div>{editForm.companionSelect === '__manual__' ? <label className="mt-3 block text-xs text-slate-500">Friend&apos;s name<input value={editForm.companionName} onChange={(event) => setEditForm((current) => ({ ...current, companionName: event.target.value }))} className="mt-1 block w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white sm:max-w-xs" /></label> : null}<div className="mt-4 flex justify-end gap-2"><button type="button" onClick={cancel} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-slate-400">Cancel</button><button type="button" onClick={save} disabled={saving || (editForm.category !== 'TROOP_GAMES' && Number(editForm.distance) <= 0)} className="rounded-lg bg-sky-500 px-4 py-2 text-xs font-black text-slate-950 disabled:opacity-40">{saving ? 'Saving…' : 'Save correction'}</button></div></div>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-black/15 p-3"><p className="text-xs text-slate-600">{label}</p><p className="mt-1 font-bold text-slate-300">{value}</p></div>;
}

function StatusPill({ status }: { status: ActivityStatus }) {
  const styles = status === 'APPROVED' ? 'bg-emerald-400/10 text-emerald-300' : status === 'REJECTED' ? 'bg-rose-400/10 text-rose-300' : 'bg-yellow-400/10 text-yellow-300';
  return <span className={`rounded-full px-2.5 py-1 text-[0.65rem] font-black tracking-wide ${styles}`}>{status}</span>;
}
