'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDownRight, ArrowUpRight, Save, Send } from 'lucide-react';
import AppShell from '@/components/AppShell';
import { useEdoAccount } from '@/hooks/useEdoAccount';
import { supabase } from '@/lib/supabase';
import type { EdoOfficer, EdoTransactionType } from '@/lib/types';

export default function NewTransactionPage() {
  const router = useRouter();
  const { access, officer, loading, error } = useEdoAccount();
  const [officers, setOfficers] = useState<EdoOfficer[]>([]);
  const [officerId, setOfficerId] = useState('');
  const [type, setType] = useState<EdoTransactionType>('GRANT');
  const [hours, setHours] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!access) return;
    if (access.role === 'OFFICER') { setOfficerId(access.officer_id ?? ''); return; }
    supabase.from('edo_officers').select('*').eq('is_active', true).order('full_name').then(({ data }) => { const list = (data as EdoOfficer[]) ?? []; setOfficers(list); setOfficerId(access.officer_id ?? list[0]?.id ?? ''); });
  }, [access]);

  async function submit(event: FormEvent, saveAs: 'DRAFT' | 'PENDING') {
    event.preventDefault(); setBusy(true); setMessage('');
    const { data, error: invokeError } = await supabase.functions.invoke('edo-command', { body: { action: 'create_transaction', officer_id: officerId || undefined, occurred_on: date, transaction_type: type, hours: Number(hours), notes, save_as: saveAs } });
    setBusy(false);
    if (invokeError) { setMessage(invokeError.message); return; }
    if (data?.error) { setMessage(data.error); return; }
    router.replace('/transactions'); router.refresh();
  }

  return <AppShell><main className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8"><div className="mb-5"><div className="text-xs font-black uppercase tracking-[.2em] text-lime-300">GRANTS / CLAIMS</div><h1 className="mt-1 text-3xl font-black">Add EDO entry</h1><p className="mt-1 text-sm text-slate-500">Save as draft or submit into the supervisor approval queue.</p></div>{loading ? <Card text="Loading profile…"/> : error ? <Card text={error}/> : <form onSubmit={(event) => submit(event, 'PENDING')} className="glass-card rounded-3xl p-5 sm:p-7"><div className="grid grid-cols-2 gap-3"><TypeButton active={type === 'GRANT'} onClick={() => setType('GRANT')} icon={ArrowUpRight} label="Grant" subtitle="Add EDO hours"/><TypeButton active={type === 'CLAIM'} onClick={() => setType('CLAIM')} icon={ArrowDownRight} label="Claim" subtitle="Use EDO hours"/></div>{access?.role !== 'OFFICER' ? <Field label="Officer"><select value={officerId} onChange={(e) => setOfficerId(e.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-3 outline-none">{officers.map((item) => <option key={item.id} value={item.id}>{item.full_name} · {item.column_code}</option>)}</select></Field> : <Field label="Officer"><div className="mt-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-3 font-bold">{officer?.full_name ?? 'Linked officer'}</div></Field>}<div className="grid gap-4 sm:grid-cols-2"><Field label="Date"><input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-3 outline-none"/></Field><Field label="Hours"><input type="number" min="0.25" max="48" step="0.25" required value={hours} onChange={(e) => setHours(e.target.value)} placeholder="e.g. 8" className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-3 outline-none"/></Field></div><Field label="Notes / reference"><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder="Optional details" className="mt-2 w-full resize-none rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-3 outline-none"/></Field><div className="mt-5 rounded-2xl border border-amber-300/15 bg-amber-300/5 p-3 text-xs leading-5 text-amber-100">Approved entries are recalculated against the 48-hour cap. If a Grant would exceed 48h, the system may move the next eligible Claim ahead of it within the same month only. Claims can never make the balance negative.</div>{message ? <div className="mt-4 rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-200">{message}</div> : null}<div className="mt-6 grid gap-3 sm:grid-cols-2"><button type="button" disabled={busy} onClick={(event) => submit(event as unknown as FormEvent, 'DRAFT')} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-black text-slate-200"><Save className="h-4 w-4"/>Save draft</button><button disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-lime-300 px-4 py-3 font-black text-slate-950"><Send className="h-4 w-4"/>{busy ? 'Saving…' : 'Submit for approval'}</button></div></form>}</main></AppShell>;
}
function TypeButton({ active, onClick, icon: Icon, label, subtitle }: { active: boolean; onClick: () => void; icon: typeof ArrowUpRight; label: string; subtitle: string }) { return <button type="button" onClick={onClick} className={`rounded-2xl border p-4 text-left ${active ? 'border-lime-300/40 bg-lime-300/10' : 'border-white/10 bg-white/5'}`}><Icon className={`h-5 w-5 ${active ? 'text-lime-300' : 'text-slate-500'}`}/><div className="mt-3 font-black">{label}</div><div className="text-xs text-slate-500">{subtitle}</div></button>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="mt-5 block text-xs font-black uppercase tracking-[.14em] text-slate-400">{label}{children}</label>; }
function Card({ text }: { text: string }) { return <div className="glass-card rounded-3xl p-6 text-sm text-slate-300">{text}</div>; }
