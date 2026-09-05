'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays } from 'lucide-react';
import { singaporeDate } from '@/lib/activity-date';

export default function ApprovedActivityDateEditor({ activity }: { activity: { id: string; occurredAt: string } }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(() => singaporeDate(new Date(activity.occurredAt)));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      const response = await fetch(`/api/activities/${activity.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ activityDate: date }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not update date.');
      setMessage('Date saved. Weekly totals updated; your awarded points are unchanged.');
      setOpen(false); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not update date.'); }
    finally { setBusy(false); }
  }
  return <div className="lg:col-span-4">
    <button type="button" disabled={busy} aria-expanded={open} onClick={() => { setDate(singaporeDate(new Date(activity.occurredAt))); setOpen(!open); }} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-sky-300/30 px-4 text-sm font-bold text-sky-200"><CalendarDays className="h-4 w-4" />{open ? 'Cancel editing' : 'Edit date'}</button>
    <p role="status" className="mt-2 text-sm text-sky-200">{message}</p>
    {open ? <form onSubmit={save} className="mt-3 space-y-4 rounded-xl border border-white/10 bg-black/20 p-4">
      <p className="text-sm text-slate-300">Correct the date you completed this activity. It stays approved, and its points move to the selected week.</p>
      <label className="block text-sm">Activity date (Singapore time)<input required type="date" value={date} max={singaporeDate()} disabled={busy} onChange={(event) => setDate(event.target.value)} className="mt-2 block w-full min-w-0 rounded-lg border border-white/20 bg-slate-950 p-3 text-white [color-scheme:dark]" /></label>
      <button disabled={busy} className="min-h-11 rounded-lg bg-sky-400 px-5 font-bold text-slate-950 disabled:opacity-50">{busy ? 'Saving…' : 'Save date'}</button>
    </form> : null}
  </div>;
}
