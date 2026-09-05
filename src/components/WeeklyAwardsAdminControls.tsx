'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';

export default function WeeklyAwardsAdminControls({ completedWeek, finalizedWeeks }: { completedWeek: number; finalizedWeeks: number[] }) {
  const router = useRouter();
  const [weekNumber, setWeekNumber] = useState(finalizedWeeks[0] ?? completedWeek);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const rebuild = async () => {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/admin/awards/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekNumber }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Unable to rebuild awards.');
      setMessage(`Week ${weekNumber} rebuilt successfully.`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to rebuild awards.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <h2 className="text-lg font-black">Rebuild finalized week</h2>
      <p className="mt-1 text-sm text-slate-500">Use this only after a late approval, rejection or correction. Rebuilding refreshes standings, awards and weekly notifications.</p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="text-sm font-bold text-slate-300">Week<select value={weekNumber} onChange={(event) => setWeekNumber(Number(event.target.value))} className="mt-2 block min-h-11 w-full rounded-xl border border-white/10 bg-slate-900 px-3 sm:w-40">{Array.from({ length: completedWeek }, (_, index) => index + 1).reverse().map((week) => <option key={week} value={week}>Week {week}</option>)}</select></label>
        <button type="button" disabled={busy || completedWeek < 1} onClick={rebuild} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-lime-300 px-4 font-black text-slate-950 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />{busy ? 'Rebuilding…' : 'Rebuild week'}</button>
      </div>
      {message ? <p role="status" className="mt-3 text-sm text-slate-300">{message}</p> : null}
    </div>
  );
}
