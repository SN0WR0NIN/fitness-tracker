'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, RefreshCcw, ShieldCheck, UserRound, X } from 'lucide-react';
import AppShell from '@/components/AppShell';
import { useEdoAccount } from '@/hooks/useEdoAccount';
import { supabase } from '@/lib/supabase';
import type { EdoLedger, EdoOfficer, EdoTransaction } from '@/lib/types';

type PendingRow = EdoTransaction & { edo_officers?: { full_name: string; column_code: string } | null };

export default function AdminPage() {
  const { access, loading, error } = useEdoAccount();
  const [officers, setOfficers] = useState<EdoOfficer[]>([]);
  const [pending, setPending] = useState<PendingRow[]>([]);
  const [ledgers, setLedgers] = useState<EdoLedger[]>([]);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    if (!access || access.role === 'OFFICER') return;
    const [officerResult, txResult, ledgerResult] = await Promise.all([
      supabase.from('edo_officers').select('*').eq('is_active', true).order('full_name'),
      supabase.from('edo_transactions').select('*, edo_officers(full_name,column_code)').in('status',['PENDING','DRAFT']).order('created_at',{ascending:false}),
      supabase.from('edo_monthly_ledgers').select('*').order('month_start',{ascending:false}),
    ]);
    setOfficers((officerResult.data as EdoOfficer[]) ?? []); setPending((txResult.data as PendingRow[]) ?? []); setLedgers((ledgerResult.data as EdoLedger[]) ?? []);
  }
  useEffect(() => { load(); }, [access]);

  async function command(action: 'approve_transaction' | 'reject_transaction' | 'rebuild_ledger', id: string) {
    setBusy(`${action}:${id}`); setMessage('');
    const reason = action === 'reject_transaction' ? window.prompt('Reason for rejection?') : null;
    if (action === 'reject_transaction' && !reason) { setBusy(''); return; }
    const body = action === 'rebuild_ledger' ? { action, officer_id: id } : { action, transaction_id: id, reason };
    const { data, error: invokeError } = await supabase.functions.invoke('edo-command', { body });
    setBusy('');
    if (invokeError) { setMessage(invokeError.message); return; }
    if (data?.error) { setMessage(data.error); return; }
    setMessage(action === 'approve_transaction' ? 'Entry approved and ledger recalculated.' : action === 'reject_transaction' ? 'Entry rejected.' : 'Ledger rebuilt.');
    await load();
  }

  const latestByOfficer = useMemo(() => { const map = new Map<string,EdoLedger>(); for (const row of ledgers) if (!map.has(row.officer_id)) map.set(row.officer_id,row); return map; }, [ledgers]);
  const critical = officers.filter((officer) => Number(latestByOfficer.get(officer.id)?.closing_balance ?? officer.starting_balance) >= 40).length;
  const warning = officers.filter((officer) => { const b = Number(latestByOfficer.get(officer.id)?.closing_balance ?? officer.starting_balance); return b >= 25 && b < 40; }).length;

  return <AppShell><main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">{loading ? <Card text="Loading control centre…"/> : error ? <Card text={error}/> : access?.role === 'OFFICER' ? <Card text="Control centre access is limited to supervisors and admins."/> : <><div className="mb-6"><div className="text-xs font-black uppercase tracking-[.2em] text-amber-300">Supervisor control</div><h1 className="mt-1 text-3xl font-black">EDO Control Centre</h1><p className="mt-1 text-sm text-slate-500">Review entries and monitor officer balances.</p></div>{message ? <div className="mb-4 rounded-2xl border border-lime-300/20 bg-lime-300/10 px-4 py-3 text-sm text-lime-100">{message}</div> : null}<section className="grid grid-cols-2 gap-3 md:grid-cols-4"><Metric icon={UserRound} label="Active officers" value={officers.length}/><Metric icon={ShieldCheck} label="Pending / draft" value={pending.length}/><Metric icon={AlertTriangle} label="Warning" value={warning}/><Metric icon={AlertTriangle} label="Critical" value={critical} critical/></section><section className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_.9fr]"><div className="glass-card rounded-3xl p-5 sm:p-6"><h2 className="text-lg font-black">Approval queue</h2><p className="mt-1 text-sm text-slate-500">Approvals trigger the 48-hour / no-negative ledger engine.</p><div className="mt-4 divide-y divide-white/5">{pending.length ? pending.map((tx) => <div key={tx.id} className="py-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="font-black">{tx.edo_officers?.full_name ?? tx.officer_id}</div><div className="mt-1 text-sm text-slate-300">{tx.transaction_type} · {Number(tx.hours).toFixed(1)}h · {tx.occurred_on}</div><div className="mt-1 text-xs text-slate-500">{tx.event_id}{tx.notes ? ` · ${tx.notes}` : ''}</div></div><div className="flex gap-2"><button disabled={Boolean(busy)} onClick={() => command('reject_transaction',tx.id)} className="rounded-xl border border-rose-300/20 bg-rose-300/10 p-2 text-rose-200" aria-label="Reject"><X className="h-4 w-4"/></button><button disabled={Boolean(busy)} onClick={() => command('approve_transaction',tx.id)} className="rounded-xl bg-lime-300 p-2 text-slate-950" aria-label="Approve"><Check className="h-4 w-4"/></button></div></div></div>) : <div className="py-8 text-center text-sm text-slate-500">Approval queue is clear.</div>}</div></div><div className="glass-card rounded-3xl p-5 sm:p-6"><h2 className="text-lg font-black">Officer balances</h2><p className="mt-1 text-sm text-slate-500">Latest calculated closing balance.</p><div className="mt-4 max-h-[32rem] divide-y divide-white/5 overflow-y-auto pr-1">{officers.map((officer) => { const ledger = latestByOfficer.get(officer.id); const balance = Number(ledger?.closing_balance ?? officer.starting_balance); const tone = balance >= 40 ? 'text-rose-300' : balance >= 25 ? 'text-amber-200' : 'text-lime-300'; return <div key={officer.id} className="flex items-center gap-3 py-3"><div className="min-w-0 flex-1"><div className="truncate font-bold">{officer.full_name}</div><div className="text-xs text-slate-500">{officer.rank ?? 'Officer'} · {officer.column_code}</div></div><div className={`font-black ${tone}`}>{balance.toFixed(1)}h</div><button title="Rebuild ledger" disabled={Boolean(busy)} onClick={() => command('rebuild_ledger',officer.id)} className="rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-white"><RefreshCcw className="h-4 w-4"/></button></div>; })}</div></div></section></>}</main></AppShell>;
}
function Metric({ icon: Icon, label, value, critical = false }: { icon: typeof UserRound; label: string; value: number; critical?: boolean }) { return <div className="glass-card rounded-2xl p-4"><Icon className={`h-5 w-5 ${critical ? 'text-rose-300' : 'text-lime-300'}`}/><div className="mt-4 text-2xl font-black">{value}</div><div className="text-xs font-bold text-slate-500">{label}</div></div>; }
function Card({ text }: { text: string }) { return <div className="glass-card rounded-3xl p-6 text-sm text-slate-300">{text}</div>; }
