'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Clock3, FileClock, ShieldCheck } from 'lucide-react';
import AppShell from '@/components/AppShell';
import { useEdoAccount } from '@/hooks/useEdoAccount';
import { supabase } from '@/lib/supabase';
import type { EdoLedger, EdoTransaction } from '@/lib/types';

export default function DashboardPage() {
  const { officer, access, loading, error } = useEdoAccount();
  const [transactions, setTransactions] = useState<EdoTransaction[]>([]);
  const [ledgers, setLedgers] = useState<EdoLedger[]>([]);
  const [settings, setSettings] = useState({ max_balance: 48, warning_balance: 25, critical_balance: 40 });

  useEffect(() => {
    if (!access) return;
    Promise.all([
      supabase.from('edo_transactions').select('*').order('occurred_on', { ascending: false }).order('created_at', { ascending: false }).limit(40),
      supabase.from('edo_monthly_ledgers').select('*').order('month_start', { ascending: false }).limit(18),
      supabase.from('edo_settings').select('*').eq('id', 1).single(),
    ]).then(([tx, ledger, config]) => {
      if (tx.data) setTransactions(tx.data as EdoTransaction[]);
      if (ledger.data) setLedgers(ledger.data as EdoLedger[]);
      if (config.data) setSettings(config.data as typeof settings);
    });
  }, [access]);

  const balance = ledgers.length ? Number(ledgers[0].closing_balance) : Number(officer?.starting_balance ?? 0);
  const level = balance >= Number(settings.critical_balance) ? 'CRITICAL' : balance >= Number(settings.warning_balance) ? 'WARNING' : 'NORMAL';
  const approved = transactions.filter((tx) => tx.status === 'APPROVED');
  const pending = transactions.filter((tx) => tx.status === 'PENDING' || tx.status === 'DRAFT').length;
  const grants = approved.filter((tx) => tx.transaction_type === 'GRANT').reduce((sum, tx) => sum + Number(tx.hours), 0);
  const claims = approved.filter((tx) => tx.transaction_type === 'CLAIM').reduce((sum, tx) => sum + Number(tx.hours), 0);
  const recent = useMemo(() => transactions.slice(0, 6), [transactions]);

  return <AppShell><main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">{loading ? <StateCard text="Loading your EDO profile…" /> : error ? <StateCard text={error} tone="error" /> : <><div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><div className="text-xs font-black uppercase tracking-[.2em] text-lime-300">{officer?.column_code ?? access?.column_code} · {access?.role}</div><h1 className="mt-1 text-3xl font-black text-white">{officer?.full_name ?? 'EDO Dashboard'}</h1><p className="mt-1 text-sm text-slate-400">Current balance and approved ledger projection.</p></div><div className={`rounded-full border px-3 py-1.5 text-xs font-black ${level === 'CRITICAL' ? 'border-rose-400/30 bg-rose-400/10 text-rose-200' : level === 'WARNING' ? 'border-amber-300/30 bg-amber-300/10 text-amber-200' : 'border-lime-300/30 bg-lime-300/10 text-lime-200'}`}>{level}</div></div>

      <section className="grid gap-4 lg:grid-cols-[1.35fr_.65fr]">
        <div className="glass-card overflow-hidden rounded-3xl p-5 sm:p-7"><div className="grid items-center gap-6 sm:grid-cols-[auto_1fr]"><BalanceRing balance={balance} max={Number(settings.max_balance)} /><div><div className="text-sm font-bold text-slate-400">Available EDO balance</div><div className="mt-1 flex items-end gap-2"><span className="athletic-display text-5xl text-white">{balance.toFixed(1)}</span><span className="pb-1 text-sm font-black text-slate-500">/ {settings.max_balance} HRS</span></div><div className="mt-5 space-y-2 text-xs font-bold text-slate-400"><Threshold label="Warning" value={Number(settings.warning_balance)} current={balance} max={Number(settings.max_balance)} /><Threshold label="Critical" value={Number(settings.critical_balance)} current={balance} max={Number(settings.max_balance)} /></div></div></div></div>
        <div className="grid grid-cols-2 gap-3"><Metric icon={ArrowUpRight} label="Approved grants" value={`${grants.toFixed(1)}h`} /><Metric icon={ArrowDownRight} label="Approved claims" value={`${claims.toFixed(1)}h`} /><Metric icon={FileClock} label="Pending / draft" value={String(pending)} /><Metric icon={ShieldCheck} label="Ledger months" value={String(ledgers.length)} /></div>
      </section>

      <section className="mt-6 glass-card rounded-3xl p-5 sm:p-6"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-lg font-black">Recent entries</h2><p className="text-sm text-slate-500">Latest Grant and Claim activity.</p></div><Clock3 className="h-5 w-5 text-slate-500"/></div>{recent.length ? <div className="divide-y divide-white/5">{recent.map((tx) => <div key={tx.id} className="flex items-center gap-3 py-3"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tx.transaction_type === 'GRANT' ? 'bg-lime-300/10 text-lime-300' : 'bg-sky-300/10 text-sky-300'}`}>{tx.transaction_type === 'GRANT' ? <ArrowUpRight className="h-4 w-4"/> : <ArrowDownRight className="h-4 w-4"/>}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-2"><span className="font-black">{tx.transaction_type} · {Number(tx.hours).toFixed(1)}h</span><span className="text-xs text-slate-500">{tx.occurred_on}</span></div><p className="truncate text-xs text-slate-500">{tx.event_id}{tx.processing_note ? ` · ${tx.processing_note}` : ''}</p></div><Status status={tx.status} /></div>)}</div> : <Empty text="No EDO entries yet." />}</section>
    </>}</main></AppShell>;
}

function BalanceRing({ balance, max }: { balance: number; max: number }) { const percent = Math.min(100, Math.max(0, balance / max * 100)); return <div className="relative h-36 w-36 shrink-0 rounded-full p-3" style={{ background: `conic-gradient(#bef264 ${percent}%, rgba(255,255,255,.08) ${percent}% 100%)` }}><div className="grid h-full w-full place-items-center rounded-full bg-slate-950"><div className="text-center"><div className="athletic-display text-4xl">{Math.round(percent)}%</div><div className="text-[10px] font-black uppercase tracking-[.16em] text-slate-500">of cap</div></div></div></div>; }
function Threshold({ label, value, current, max }: { label: string; value: number; current: number; max: number }) { return <div><div className="mb-1 flex justify-between"><span>{label}: {value}h</span><span>{current >= value ? 'Reached' : `${(value-current).toFixed(1)}h away`}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-slate-500" style={{ width: `${Math.min(100, value/max*100)}%` }} /></div></div>; }
function Metric({ icon: Icon, label, value }: { icon: typeof AlertTriangle; label: string; value: string }) { return <div className="glass-card rounded-2xl p-4"><Icon className="h-5 w-5 text-lime-300"/><div className="mt-4 text-2xl font-black">{value}</div><div className="mt-1 text-xs font-bold text-slate-500">{label}</div></div>; }
function Status({ status }: { status: EdoTransaction['status'] }) { const cls = status === 'APPROVED' ? 'text-lime-300 bg-lime-300/10' : status === 'REJECTED' ? 'text-rose-300 bg-rose-300/10' : 'text-amber-200 bg-amber-300/10'; return <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${cls}`}>{status}</span>; }
function StateCard({ text, tone = 'normal' }: { text: string; tone?: 'normal' | 'error' }) { return <div className={`glass-card rounded-3xl p-6 text-sm ${tone === 'error' ? 'text-rose-200' : 'text-slate-300'}`}>{text}</div>; }
function Empty({ text }: { text: string }) { return <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-slate-500">{text}</div>; }
