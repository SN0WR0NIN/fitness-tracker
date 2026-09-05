'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Filter, Plus } from 'lucide-react';
import AppShell from '@/components/AppShell';
import { useEdoAccount } from '@/hooks/useEdoAccount';
import { supabase } from '@/lib/supabase';
import type { EdoTransaction } from '@/lib/types';

export default function TransactionsPage() {
  const { access, loading, error } = useEdoAccount();
  const [rows, setRows] = useState<EdoTransaction[]>([]);
  const [filter, setFilter] = useState('ALL');

  useEffect(() => { if (!access) return; supabase.from('edo_transactions').select('*').order('occurred_on', { ascending: false }).order('created_at', { ascending: false }).then(({ data }) => setRows((data as EdoTransaction[]) ?? [])); }, [access]);
  const filtered = useMemo(() => filter === 'ALL' ? rows : rows.filter((row) => row.status === filter || row.transaction_type === filter), [rows, filter]);

  return <AppShell><main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8"><div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><div className="text-xs font-black uppercase tracking-[.2em] text-lime-300">GRANTS / CLAIMS</div><h1 className="mt-1 text-3xl font-black">My entries</h1><p className="mt-1 text-sm text-slate-500">Chronological submissions with effective balance order after approval.</p></div><Link href="/transactions/new" className="inline-flex items-center gap-2 rounded-2xl bg-lime-300 px-4 py-2.5 text-sm font-black text-slate-950"><Plus className="h-4 w-4"/>New entry</Link></div>
    {loading ? <Card text="Loading entries…"/> : error ? <Card text={error}/> : <><div className="mb-4 flex items-center gap-2 overflow-x-auto pb-1"><Filter className="h-4 w-4 shrink-0 text-slate-500"/>{['ALL','GRANT','CLAIM','PENDING','APPROVED','REJECTED'].map((item) => <button key={item} onClick={() => setFilter(item)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-black ${filter === item ? 'bg-lime-300 text-slate-950' : 'border border-white/10 bg-white/5 text-slate-400'}`}>{item}</button>)}</div><div className="glass-card overflow-hidden rounded-3xl"><div className="divide-y divide-white/5">{filtered.length ? filtered.map((tx) => <article key={tx.id} className="grid gap-3 p-4 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:p-5"><span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tx.transaction_type === 'GRANT' ? 'bg-lime-300/10 text-lime-300' : 'bg-sky-300/10 text-sky-300'}`}>{tx.transaction_type === 'GRANT' ? <ArrowUpRight/> : <ArrowDownRight/>}</span><div><div className="flex flex-wrap items-center gap-2"><span className="font-black">{tx.transaction_type} · {Number(tx.hours).toFixed(1)}h</span><span className="text-xs text-slate-500">{tx.occurred_on}</span></div><p className="mt-1 text-xs text-slate-500">{tx.event_id}{tx.notes ? ` · ${tx.notes}` : ''}</p>{tx.processing_note ? <p className="mt-1 text-xs font-bold text-amber-200">{tx.processing_note}</p> : null}{tx.rejection_reason ? <p className="mt-1 text-xs text-rose-300">Rejected: {tx.rejection_reason}</p> : null}</div><div className="flex items-center gap-2 sm:justify-end"><Status status={tx.status}/>{tx.running_balance != null ? <span className="rounded-lg bg-white/5 px-2 py-1 text-xs font-black text-slate-300">Bal {Number(tx.running_balance).toFixed(1)}h</span> : null}</div></article>) : <div className="p-10 text-center text-sm text-slate-500">No matching entries.</div>}</div></div></>}</main></AppShell>;
}
function Status({ status }: { status: EdoTransaction['status'] }) { const cls = status === 'APPROVED' ? 'text-lime-300 bg-lime-300/10' : status === 'REJECTED' ? 'text-rose-300 bg-rose-300/10' : 'text-amber-200 bg-amber-300/10'; return <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${cls}`}>{status}</span>; }
function Card({ text }: { text: string }) { return <div className="glass-card rounded-3xl p-6 text-sm text-slate-300">{text}</div>; }
