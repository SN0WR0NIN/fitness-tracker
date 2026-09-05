'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from './Navbar';
import type { ImportRow } from '@/lib/historical-import';

type User = { id: string; name: string; email: string; unclaimed: boolean };
type Mapping = { userId: string; columnId: string };
type PreviewRow = ImportRow & { id: string; points: number; duplicate: boolean; possibleDuplicate: boolean; skipped: boolean; error: string | null };
const keyOf = (row: ImportRow) => [row.name, row.column].map((value) => value.trim().toLocaleLowerCase('en').replace(/\s+/g, ' ')).join('|');
const field = 'w-full rounded-lg border border-white/20 bg-slate-900 p-3 text-white';

export default function HistoricalImport({ users, columns }: { users: User[]; columns: { id: string; name: string }[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [mappings, setMappings] = useState<Record<string, Mapping>>({});
  const [skip, setSkip] = useState<string[]>([]);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [previewHash, setPreviewHash] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [targetId, setTargetId] = useState('');
  const participants = Array.from(new Map(rows.map((row) => [keyOf(row), row])).entries());
  const unclaimed = users.filter((user) => user.unclaimed);
  const registered = users.filter((user) => !user.unclaimed);
  async function load(file?: File) {
    if (!file) return;
    setPreview([]); setPreviewHash(''); setRows([]); setMessage(''); setSkip([]);
    try {
      if (file.size > 1000000) throw new Error('Choose a prepared import file smaller than 1MB.');
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.rows) || !data.rows.length || data.rows.length > 500 || data.rows.some((row: ImportRow) => typeof row.name !== 'string' || typeof row.column !== 'string')) throw new Error('Choose a prepared KG historical import JSON file.');
      const clean = (data.rows as ImportRow[]).filter((row) => row.name.trim().toUpperCase() !== 'TEST');
      setRows(clean);
      setMappings(Object.fromEntries(clean.map((row) => [keyOf(row), { userId: '', columnId: columns.find((column) => column.name === row.column)?.id ?? '' }])));
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to read file.'); }
  }
  async function run(commit = false) {
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/admin/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows, mappings, skip, commit, previewHash }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (commit) { setMessage(`Imported ${data.imported} approved activities; skipped ${data.skipped}.`); setPreviewHash(''); setPreview([]); setRows([]); router.refresh(); }
      else { setPreview(data.preview); setPreviewHash(data.previewHash); }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Request failed.'); setPreviewHash(''); }
    finally { setBusy(false); }
  }
  async function link() {
    if (!window.confirm('Confirm you have verified these records belong to the same person. Their historical activities and points will move to the signed-up account; the empty unclaimed record will be removed.')) return;
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/admin/import/link', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sourceId, targetId }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setMessage('Participant history linked successfully.'); setSourceId(''); setTargetId(''); setPreviewHash(''); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Linking failed.'); }
    finally { setBusy(false); }
  }
  const selected = preview.filter((row) => !row.duplicate && !skip.includes(row.id));
  return <div className="min-h-screen bg-slate-950 text-white"><Navbar /><main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
    <Link href="/admin/users" className="text-orange-300">← Manage users</Link>
    <h1 className="text-3xl font-black">Historical activity import</h1>
    <p className="text-slate-300">Upload the prepared import file, confirm each participant, then review recalculated points. TEST entries are excluded. Importing approves the selected activities immediately.</p>
    {message ? <p role="status" className="rounded-xl border border-orange-300/30 p-4">{message}</p> : null}
    <label className="block rounded-xl border border-white/10 p-5">Prepared KG import file (.json)<input aria-label="Prepared KG import file" type="file" accept=".json,application/json" disabled={busy} onChange={(event) => void load(event.target.files?.[0])} className="mt-3 block w-full" /></label>
    {rows.length ? <section className="space-y-4"><h2 className="text-xl font-bold">Match {participants.length} participants · {rows.length} submissions</h2><p className="text-sm text-slate-300">Choose an existing account or an unclaimed record for every name. Check aliases carefully to avoid creating a second record for someone already registered.</p>
      {participants.map(([key, row]) => <div key={key} className="grid gap-3 rounded-xl border border-white/10 p-4 sm:grid-cols-3"><p>{row.name}<span className="block text-xs text-slate-400">Sheet: {row.column}</span></p><select aria-label={`Account for ${row.name}`} disabled={busy} value={mappings[key]?.userId ?? ''} onChange={(event) => { setMappings({ ...mappings, [key]: { ...mappings[key], userId: event.target.value } }); setPreviewHash(''); }} className={field}><option value="">Choose participant…</option><option value="NEW">Create unclaimed record</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name}{user.email.endsWith('@participants.invalid') ? ' (unclaimed)' : ` (${user.email})`}</option>)}</select><select aria-label={`Column for ${row.name}`} disabled={busy} value={mappings[key]?.columnId ?? ''} onChange={(event) => { setMappings({ ...mappings, [key]: { ...mappings[key], columnId: event.target.value } }); setPreviewHash(''); }} className={field}><option value="">Choose column…</option>{columns.map((column) => <option key={column.id} value={column.id}>{column.name}</option>)}</select></div>)}
      <button disabled={busy} onClick={() => void run()} className="rounded-xl bg-orange-500 px-5 py-3 font-bold disabled:opacity-40">{busy ? 'Working…' : 'Preview recalculated points'}</button>
    </section> : null}
    {preview.length ? <section className="space-y-4"><h2 className="text-xl font-bold">Review activities</h2><p>{selected.length} selected · {selected.reduce((total, row) => total + row.points, 0).toFixed(1)} points</p><p className="text-sm text-slate-300">Exact repeat imports are skipped automatically. Possible duplicates must be skipped here and reviewed separately. Changing a selection requires a fresh preview.</p>{preview.map((row, index) => <div key={`${row.id}-${index}`} className="rounded-xl border border-white/10 p-4"><label className="flex items-start gap-3"><input type="checkbox" aria-label={`Include ${row.name} activity ${index + 1}`} checked={!row.duplicate && !skip.includes(row.id)} disabled={busy || row.duplicate} onChange={(event) => { setSkip(event.target.checked ? skip.filter((id) => id !== row.id) : [...skip, row.id]); setPreviewHash(''); }} className="mt-1 h-5 w-5" /><span><strong>{row.name} · {row.category} · {row.points.toFixed(1)} pts</strong><span className="block text-sm text-slate-300">{new Date(row.occurredAt).toLocaleString('en-SG', { timeZone: 'Asia/Singapore' })} · {row.distance} {row.category === 'SWIM' ? 'm' : 'km'}</span><span className="block text-sm text-amber-300">{row.error || (row.duplicate ? 'Already imported / repeated row — skipped' : row.possibleDuplicate ? 'Possible duplicate — skip and review separately' : '')}</span></span></label>{row.proofUrl ? <a href={row.proofUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-sky-300">View original proof ↗</a> : <p className="mt-2 text-sm text-amber-300">No proof link in source</p>}</div>)}<button disabled={busy || !previewHash || !selected.length || selected.some((row) => row.error || row.possibleDuplicate)} onClick={() => { if (window.confirm(`Import ${selected.length} activities as approved? Their points will appear on the leaderboard.`)) void run(true); }} className="rounded-xl bg-orange-500 px-5 py-3 font-bold disabled:opacity-40">Import selected as approved</button></section> : null}
    <section className="space-y-4 rounded-xl border border-white/10 p-5"><h2 className="text-xl font-bold">Link history after signup</h2><p className="text-sm text-slate-300">Verify the person’s identity before linking. Names alone do not prove account ownership. Historical column assignments are retained.</p><label className="block">Unclaimed participant<select className={field} value={sourceId} disabled={busy} onChange={(event) => setSourceId(event.target.value)}><option value="">Choose unclaimed participant…</option>{unclaimed.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label><label className="block">Signed-up account<select className={field} value={targetId} disabled={busy} onChange={(event) => setTargetId(event.target.value)}><option value="">Choose verified account…</option>{registered.map((user) => <option key={user.id} value={user.id}>{user.name} ({user.email})</option>)}</select></label><button disabled={busy || !sourceId || !targetId} onClick={() => void link()} className="rounded-xl border border-orange-400 px-5 py-3 font-bold disabled:opacity-40">Link verified participant</button></section>
  </main></div>;
}
