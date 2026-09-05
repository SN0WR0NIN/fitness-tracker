import Link from 'next/link';
import { ArrowRight, Gauge, History, ShieldCheck } from 'lucide-react';

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-10 sm:px-6">
      <div className="grid-fade pointer-events-none absolute inset-0 opacity-70" />
      <div className="relative mx-auto max-w-6xl">
        <div className="mb-16 flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-lime-300 font-black text-slate-950">KG</span><div><div className="text-xs font-black uppercase tracking-[.24em] text-lime-300">Kilo Golf</div><div className="font-black">EDO Tracker</div></div></div>
        <section className="max-w-4xl py-10 sm:py-16">
          <div className="mb-4 inline-flex rounded-full border border-lime-300/20 bg-lime-300/10 px-3 py-1 text-xs font-black uppercase tracking-[.18em] text-lime-300">48-hour controlled ledger</div>
          <h1 className="athletic-display text-5xl leading-[.92] text-white sm:text-7xl">Your EDO balance.<br/><span className="text-lime-300">Clear, fast, accountable.</span></h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg">A dedicated EDO system built in the same mobile-first style as KG Stay Active, with officer ledgers, Grant/Claim workflow, approval controls and automatic 48-hour protection.</p>
          <div className="mt-8 flex flex-wrap gap-3"><Link href="/login" className="inline-flex items-center gap-2 rounded-2xl bg-lime-300 px-5 py-3 font-black text-slate-950 shadow-lg shadow-lime-300/20">Open EDO Tracker <ArrowRight className="h-4 w-4" /></Link></div>
        </section>
        <section className="grid gap-4 md:grid-cols-3">{[
          [Gauge, 'Balance at a glance', 'Normal, warning and critical status from your current EDO balance.'],
          [History, 'Grant & Claim history', 'Every entry keeps its date, approval state, effective order and running balance.'],
          [ShieldCheck, 'Supervisor control', 'Review pending entries and enforce the no-negative and 48-hour rules.'],
        ].map(([Icon, title, copy]) => { const I = Icon as typeof Gauge; return <div key={String(title)} className="glass-card rounded-3xl p-6"><I className="mb-5 h-7 w-7 text-lime-300"/><h2 className="text-lg font-black">{String(title)}</h2><p className="mt-2 text-sm leading-6 text-slate-400">{String(copy)}</p></div>; })}</section>
      </div>
    </main>
  );
}
