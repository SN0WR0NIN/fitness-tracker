'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
type Activity = { id: string; category: string; distance: number; pace: number | null; proofUrl: string | null; companionUserId: string | null; stravaActivityId: string | null };
export default function PendingActivityEditor({ activity, users }: { activity: Activity; users: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState(activity.category);
  const [distance, setDistance] = useState(String(activity.distance));
  const [pace, setPace] = useState(activity.pace?.toString() ?? '');
  const [proof, setProof] = useState(activity.proofUrl ?? '');
  const [companion, setCompanion] = useState(activity.companionUserId ?? '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      const body = activity.stravaActivityId ? { companionUserId: companion || null } : { category, distance: category === 'TROOP_GAMES' ? undefined : Number(distance), pace: category === 'RUN' && pace ? Number(pace) : null, proofUrl: proof.trim() || null, companionUserId: companion || null };
      const response = await fetch(`/api/activities/${activity.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Could not save.');
      setMessage('Saved. Points recalculated; still awaiting approval.'); setOpen(false); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save.'); }
    finally { setBusy(false); }
  }
  const field = 'mt-1 w-full rounded-lg border border-white/20 bg-slate-950 p-3 text-white';
  return <div className="lg:col-span-4"><button type="button" className="min-h-11 rounded-lg border border-sky-300/30 px-4 text-sm font-bold text-sky-200" onClick={() => setOpen(!open)} disabled={busy} aria-expanded={open}>{open ? 'Cancel editing' : 'Edit pending submission'}</button><p role="status" className="mt-2 text-sm text-sky-200">{message}</p>{open ? <form onSubmit={save} className="mt-3 grid gap-4 rounded-xl border border-white/10 bg-black/20 p-4 sm:grid-cols-2"><p className="text-sm text-slate-300 sm:col-span-2">{activity.stravaActivityId ? 'Workout details come from Strava. You can correct your companion here.' : 'Correct your submission before review. Swimming distance is in metres; other distances are in kilometres.'}</p>{!activity.stravaActivityId ? <><label>Activity<select value={category} onChange={(e) => setCategory(e.target.value)} className={field}>{[['RUN','Run'],['CYCLE','Cycle'],['SWIM','Swim'],['WALK_OR_HIKE','Walk / Hike'],['TROOP_GAMES','Troop games']].map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>{category !== 'TROOP_GAMES' ? <label>Distance ({category === 'SWIM' ? 'm' : 'km'})<input required type="number" min="0.001" max="100000" step="any" value={distance} onChange={(e) => setDistance(e.target.value)} className={field} /></label> : null}{category === 'RUN' ? <label>Pace (decimal minutes/km)<input type="number" min="0.01" max="60" step="any" value={pace} onChange={(e) => setPace(e.target.value)} className={field} /><span className="text-xs text-slate-400">Example: 5.5 means 5:30/km</span></label> : null}<label>Proof link<input type="url" maxLength={2048} value={proof} onChange={(e) => setProof(e.target.value)} className={field} /></label></> : null}<label>Companion<select value={companion} onChange={(e) => setCompanion(e.target.value)} className={field}><option value="">Solo activity</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label><div className="flex flex-wrap gap-3 sm:col-span-2"><button disabled={busy} className="min-h-11 rounded-lg bg-sky-400 px-5 font-bold text-slate-950 disabled:opacity-50">{busy ? 'Saving…' : 'Save changes'}</button><button type="button" disabled={busy} onClick={() => setOpen(false)} className="min-h-11 rounded-lg border border-white/20 px-5">Cancel</button></div></form> : null}</div>;
}
