'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { CheckCircle2, ImagePlus, ShieldCheck, Sparkles, Upload, Users, XCircle } from 'lucide-react';
import { calculateActivityPoints, resolveEffectiveCategory, type ActivityCategory, type ScoringRules } from '@/lib/scoring';

const MAX_FILE_SIZE = 4 * 1024 * 1024;
const categories: Array<{ value: ActivityCategory; label: string; icon: string }> = [
  { value: 'RUN', label: 'Run', icon: '🏃' },
  { value: 'CYCLE', label: 'Cycle', icon: '🚴' },
  { value: 'SWIM', label: 'Swim', icon: '🏊' },
  { value: 'WALK_OR_HIKE', label: 'Walk / Hike', icon: '🥾' },
  { value: 'TROOP_GAMES', label: 'Troop Games', icon: '🎯' },
];

type UserOption = { id: string; name: string; username: string | null; columnId: string; columnName: string };
type Outcome = { status: 'PENDING' | 'APPROVED'; activityId: string; message: string; duplicateWarning?: boolean };

function parsePace(value: string): number | undefined {
  if (!value.trim()) return undefined;
  if (value.includes(':')) {
    const [minutesText, secondsText] = value.split(':');
    const minutes = Number(minutesText);
    const seconds = Number(secondsText);
    if (!Number.isFinite(minutes) || !Number.isFinite(seconds) || seconds < 0 || seconds >= 60) return undefined;
    return minutes + seconds / 60;
  }
  const decimal = Number(value);
  return Number.isFinite(decimal) ? decimal : undefined;
}

export default function AdminCreateActivityForm({ users, scoringRules, challengeStart, challengeEnd, today }: {
  users: UserOption[];
  scoringRules: ScoringRules;
  challengeStart: string;
  challengeEnd: string;
  today: string;
}) {
  const maxDate = today < challengeEnd ? today : challengeEnd;
  const [userId, setUserId] = useState('');
  const [activityDate, setActivityDate] = useState(maxDate >= challengeStart ? maxDate : challengeStart);
  const [category, setCategory] = useState<ActivityCategory>('RUN');
  const [distance, setDistance] = useState('');
  const [pace, setPace] = useState('');
  const [companionUserId, setCompanionUserId] = useState('');
  const [proofUrl, setProofUrl] = useState('');
  const [approvalMode, setApprovalMode] = useState<'PENDING' | 'APPROVED'>('PENDING');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const selectedUser = users.find((user) => user.id === userId) ?? null;
  const distanceNumber = distance ? Number(distance) : undefined;
  const paceNumber = category === 'RUN' ? parsePace(pace) : undefined;
  const effectiveCategory = resolveEffectiveCategory(category, paceNumber, scoringRules);
  const points = useMemo(() => calculateActivityPoints({
    category: effectiveCategory,
    distance: distanceNumber,
    pace: paceNumber,
    completedWithFriend: Boolean(companionUserId),
  }, scoringRules).totalPoints, [effectiveCategory, distanceNumber, paceNumber, companionUserId, scoringRules]);

  const validation = useMemo(() => {
    if (!userId) return 'Choose the participant receiving this activity.';
    if (!activityDate || activityDate < challengeStart || activityDate > maxDate) return `Choose a date from ${challengeStart} to ${maxDate}.`;
    if (category !== 'TROOP_GAMES' && (!distanceNumber || distanceNumber <= 0)) return 'Enter a distance greater than zero.';
    if (category === 'RUN' && pace && (!paceNumber || paceNumber <= 0)) return 'Use a pace such as 6:30 or 6.5.';
    if (companionUserId === userId) return 'The participant cannot be their own companion.';
    return '';
  }, [activityDate, category, challengeStart, companionUserId, distanceNumber, maxDate, pace, paceNumber, userId]);

  async function uploadProof(file: File) {
    setMessage('');
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      setMessage('Choose a JPEG, PNG, WebP or GIF image.');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setMessage('Proof image must be 4MB or smaller.');
      return;
    }
    setUploading(true);
    try {
      const body = new FormData();
      body.append('file', file);
      const response = await fetch('/api/upload', { method: 'POST', body });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || typeof data.url !== 'string') throw new Error(typeof data.error === 'string' ? data.error : 'Proof upload failed.');
      setProofUrl(data.url);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Proof upload failed.');
    } finally {
      setUploading(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage('');
    setOutcome(null);
    if (validation) { setMessage(validation); return; }
    setSubmitting(true);
    try {
      const response = await fetch('/api/admin/activities/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          activityDate,
          category,
          distance: category === 'TROOP_GAMES' ? undefined : distanceNumber,
          pace: category === 'RUN' ? paceNumber : undefined,
          companionUserId: companionUserId || undefined,
          proofUrl: proofUrl || undefined,
          approvalMode,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 409 && data.activity?.id) {
        setOutcome({ status: 'PENDING', activityId: data.activity.id, message: data.error || 'Created as Pending for duplicate review.', duplicateWarning: true });
        return;
      }
      if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Could not create activity.');
      const status = data.createdAs === 'APPROVED' ? 'APPROVED' : 'PENDING';
      setOutcome({ status, activityId: data.activity.id, message: data.warning || (status === 'APPROVED' ? 'Activity created and approved. Points are live on the leaderboard.' : 'Activity created as Pending and added to the review queue.') });
      setDistance('');
      setPace('');
      setCompanionUserId('');
      setProofUrl('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not create activity.');
    } finally {
      setSubmitting(false);
    }
  }

  const field = 'mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-orange-400';

  return (
    <div className="mt-4 space-y-6">
      <header className="rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(249,115,22,0.18),_transparent_45%),rgba(255,255,255,0.04)] p-6 sm:p-8">
        <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-orange-300"><ShieldCheck className="h-4 w-4" />Admin entry</p>
        <h1 className="mt-2 text-3xl font-black sm:text-5xl">Create activity for participant</h1>
        <p className="mt-3 max-w-3xl text-slate-400">Enter a verified workout on behalf of a participant. The same challenge dates, scoring rules and duplicate checks apply.</p>
      </header>

      {outcome ? <section className={`rounded-2xl border p-5 ${outcome.duplicateWarning ? 'border-amber-400/30 bg-amber-400/10' : outcome.status === 'APPROVED' ? 'border-emerald-400/30 bg-emerald-400/10' : 'border-sky-400/30 bg-sky-400/10'}`}>
        <div className="flex gap-3">{outcome.duplicateWarning ? <XCircle className="h-5 w-5 shrink-0 text-amber-300" /> : <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-300" />}<div><p className="font-black">{outcome.status === 'APPROVED' ? 'Approved activity created' : 'Pending activity created'}</p><p className="mt-1 text-sm text-slate-300">{outcome.message}</p><div className="mt-4 flex flex-wrap gap-2"><Link href="/admin/activities" className="rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-bold">Open review queue</Link><button type="button" onClick={() => setOutcome(null)} className="rounded-xl border border-white/20 px-4 py-2.5 text-sm font-bold">Add another</button></div></div></div>
      </section> : null}

      {message ? <p role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-200">{message}</p> : null}

      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-5 rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
          <label className="block">Participant
            <select required value={userId} onChange={(event) => { setUserId(event.target.value); if (event.target.value === companionUserId) setCompanionUserId(''); }} className={field}>
              <option value="">Choose participant</option>
              {users.map((user) => <option key={user.id} value={user.id}>{user.name} · {user.columnName}{user.username ? ` · @${user.username}` : ''}</option>)}
            </select>
          </label>
          {selectedUser ? <div className="rounded-xl border border-orange-300/15 bg-orange-300/[0.06] p-4 text-sm"><p className="font-bold">{selectedUser.name}</p><p className="mt-1 text-slate-400">{selectedUser.columnName}{selectedUser.username ? ` · @${selectedUser.username}` : ''}</p></div> : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">Activity date<input required type="date" min={challengeStart} max={maxDate} value={activityDate} onChange={(event) => setActivityDate(event.target.value)} className={field} /></label>
            <label className="block">Activity type<select value={category} onChange={(event) => { const next = event.target.value as ActivityCategory; setCategory(next); if (next !== 'RUN') setPace(''); if (next === 'TROOP_GAMES') setDistance(''); }} className={field}>{categories.map((item) => <option key={item.value} value={item.value}>{item.icon} {item.label}</option>)}</select></label>
          </div>

          {category !== 'TROOP_GAMES' ? <div className="grid gap-4 sm:grid-cols-2"><label className="block">Distance ({category === 'SWIM' ? 'metres' : 'km'})<input required type="number" min="0.01" step="0.01" value={distance} onChange={(event) => setDistance(event.target.value)} className={field} /></label>{category === 'RUN' ? <label className="block">Pace (min/km)<input value={pace} onChange={(event) => setPace(event.target.value)} placeholder="6:30 or 6.5" className={field} /></label> : <div />}</div> : <p className="rounded-xl border border-white/10 bg-black/10 p-4 text-sm text-slate-400">Troop Games uses the configured fixed points and does not require distance.</p>}

          <label className="block">Companion <span className="text-slate-500">(optional)</span><select value={companionUserId} onChange={(event) => setCompanionUserId(event.target.value)} className={field}><option value="">Solo activity</option>{users.filter((user) => user.id !== userId).map((user) => <option key={user.id} value={user.id}>{user.name} · {user.columnName}</option>)}</select></label>

          <div><p className="font-medium">Proof screenshot <span className="text-slate-500">(optional)</span></p>{proofUrl ? <div className="mt-3 overflow-hidden rounded-xl border border-white/10"><div className="relative h-56 bg-black/20"><Image src={proofUrl} alt="Uploaded activity proof" fill unoptimized sizes="(max-width: 1024px) 100vw, 640px" className="object-contain" /></div><button type="button" onClick={() => setProofUrl('')} className="w-full border-t border-white/10 p-3 text-sm text-rose-300">Remove proof</button></div> : <label className="mt-3 flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-white/15 bg-black/10 p-5 text-center hover:border-orange-300/40"><ImagePlus className="h-7 w-7 text-orange-300" /><span className="mt-2 text-sm font-bold">{uploading ? 'Uploading…' : 'Choose proof image'}</span><span className="mt-1 text-xs text-slate-500">JPEG, PNG, WebP or GIF · max 4MB</span><input disabled={uploading} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadProof(file); event.target.value = ''; }} /></label>}</div>
        </div>

        <aside className="space-y-4">
          <section className="sticky top-4 rounded-2xl border border-orange-300/20 bg-slate-950/95 p-5 shadow-2xl shadow-black/30 backdrop-blur-xl">
            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-orange-300"><Sparkles className="h-4 w-4" />Score preview</p>
            <p className="mt-4 text-5xl font-black">{Number.isFinite(points) ? points.toFixed(1) : '0.0'}</p><p className="text-sm text-slate-500">points</p>
            {effectiveCategory !== category ? <p className="mt-3 rounded-lg bg-amber-400/10 p-3 text-xs text-amber-200">This run is scored as Walk / Hike under the current pace rule.</p> : null}
            <div className="mt-5 border-t border-white/10 pt-5"><p className="flex items-center gap-2 text-sm font-bold"><Users className="h-4 w-4" />Review status</p><div className="mt-3 space-y-2"><label className="flex cursor-pointer gap-3 rounded-xl border border-white/10 p-3"><input type="radio" name="approvalMode" checked={approvalMode === 'PENDING'} onChange={() => setApprovalMode('PENDING')} /><span><strong className="block">Create as Pending</strong><span className="text-xs text-slate-500">Safe default. Review it normally before points go live.</span></span></label><label className="flex cursor-pointer gap-3 rounded-xl border border-white/10 p-3"><input type="radio" name="approvalMode" checked={approvalMode === 'APPROVED'} onChange={() => setApprovalMode('APPROVED')} /><span><strong className="block">Create & Approve</strong><span className="text-xs text-slate-500">Use when evidence is already verified. Duplicate protection still applies.</span></span></label></div></div>
            <button disabled={submitting || uploading || Boolean(validation)} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 font-black disabled:cursor-not-allowed disabled:opacity-40"><Upload className="h-4 w-4" />{submitting ? 'Creating…' : approvalMode === 'APPROVED' ? 'Create & approve' : 'Create pending activity'}</button>
            {validation ? <p className="mt-3 text-xs text-slate-500">{validation}</p> : null}
          </section>
        </aside>
      </form>
    </div>
  );
}
