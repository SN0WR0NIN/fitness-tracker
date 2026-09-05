'use client';
import { useState } from 'react';
export default function WeeklyRecap({ text }: { text: string }) {
  const [message, setMessage] = useState('');
  async function copy() {
    try { await navigator.clipboard.writeText(text); setMessage('Copied. Paste it into your group when ready.'); }
    catch { setMessage('Clipboard unavailable. Select and copy the message below.'); }
  }
  return <section className="space-y-4"><button type="button" onClick={() => void copy()} className="min-h-11 rounded-xl bg-orange-500 px-5 py-3 font-bold">Copy weekly recap</button><p role="status">{message}</p><textarea aria-label="Weekly recap message" readOnly value={text} rows={24} className="w-full rounded-xl border border-white/15 bg-slate-900 p-4 text-sm leading-7 text-white" onFocus={(event) => event.target.select()} /></section>;
}
