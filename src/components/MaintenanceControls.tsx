'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { OperatingMode, OperatingState } from '@/lib/operating-mode';

const descriptions: Record<OperatingMode,string> = {
  NORMAL: 'Participants can submit and edit activities. Admin review and imports are available.',
  PAUSED: 'Participant activity submissions, edits, corrections, uploads and Strava imports are paused. Admin review remains available.',
  READ_ONLY: 'Competition data is locked for everyone, including admins: no activity changes, approvals, imports or result rebuilds. Viewing, login, account recovery, backups and unlocking remain available.',
};

export default function MaintenanceControls({ initial }: { initial: OperatingState }) {
  const router = useRouter();
  const [current, setCurrent] = useState(initial);
  const [mode, setMode] = useState<OperatingMode>(initial.mode);
  const [message, setMessage] = useState(initial.message);
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setStatus('');
    try {
      const response = await fetch('/api/admin/maintenance', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ mode, message, confirmation, expectedUpdatedAt:current.updatedAt }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not update controls');
      setCurrent(result); setConfirmation(''); setStatus(`Saved. Current mode: ${result.mode}.`); router.refresh();
      window.dispatchEvent(new Event('kg:config-changed'));
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Unable to update controls'); }
    finally { setBusy(false); }
  }
  return <form onSubmit={save} className="space-y-5 rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:p-7">
    <div className="rounded-xl border border-amber-300/20 bg-amber-300/5 p-4"><p className="font-bold">Current mode: <span className="text-lime-300">{current.mode}</span></p><p className="mt-2 text-sm text-slate-300">{descriptions[current.mode]}</p></div>
    <label className="block text-sm font-bold">Operating mode<select disabled={busy} value={mode} onChange={(e) => { setMode(e.target.value as OperatingMode); setConfirmation(''); }} className="mt-2 block min-h-11 w-full rounded-xl border border-white/20 bg-slate-900 p-3"><option value="NORMAL">Normal</option><option value="PAUSED">Pause participant submissions</option><option value="READ_ONLY">Read-only competition lock (including admins)</option></select></label>
    <p className="text-sm text-slate-400">{descriptions[mode]}</p>
    <label className="block text-sm font-bold">Participant message<textarea required minLength={3} maxLength={240} disabled={busy} value={message} onChange={(e) => setMessage(e.target.value)} className="mt-2 block min-h-24 w-full rounded-xl border border-white/20 bg-slate-900 p-3" /></label>
    <label className="block text-sm font-bold">Type {mode} to confirm<input autoComplete="off" required disabled={busy} value={confirmation} onChange={(e) => setConfirmation(e.target.value)} className="mt-2 block min-h-11 w-full rounded-xl border border-white/20 bg-slate-900 p-3" /></label>
    <p className="text-xs leading-5 text-slate-400">Every change is recorded in the admin audit trail. This does not sign users out. An admin can always return here to unlock the competition. Requests already running when submissions are paused may finish; the read-only lock also guards database writes.</p>
    <button disabled={busy || confirmation !== mode} className="min-h-11 rounded-xl bg-lime-300 px-5 py-3 font-black text-slate-950 disabled:opacity-40">{busy ? 'Saving…' : 'Save operating mode'}</button>
    <p role="status" aria-live="polite" className="text-sm text-sky-200">{status}</p>
  </form>;
}
