'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { BookOpen, Gauge, History, Home, LogOut, Menu, Plus, ShieldCheck, UserRound, X } from 'lucide-react';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';

const nav = [
  { href: '/dashboard', label: 'Home', icon: Gauge },
  { href: '/transactions', label: 'Entries', icon: History },
  { href: '/ledger', label: 'Ledger', icon: BookOpen },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const showDock = pathname !== '/login' && pathname !== '/';

  async function signOut() {
    await supabase.auth.signOut();
    router.replace('/login');
    router.refresh();
  }

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/dashboard" className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-lime-300 font-black text-slate-950 shadow-lg shadow-lime-300/20">KG</span>
            <div className="leading-tight"><div className="text-xs font-black uppercase tracking-[.22em] text-lime-300">Kilo Golf</div><div className="font-black text-white">EDO Tracker</div></div>
          </Link>
          <div className="hidden items-center gap-1 md:flex">
            {nav.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold ${pathname.startsWith(href) ? 'bg-white/10 text-lime-300' : 'text-slate-400 hover:text-white'}`}><Icon className="h-4 w-4" />{label}</Link>)}
            <Link href="/admin" className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold ${pathname.startsWith('/admin') ? 'bg-white/10 text-amber-300' : 'text-slate-400 hover:text-white'}`}><ShieldCheck className="h-4 w-4" />Control</Link>
            <button onClick={signOut} className="ml-2 rounded-xl p-2 text-slate-400 hover:bg-white/10 hover:text-white" aria-label="Log out"><LogOut className="h-5 w-5" /></button>
          </div>
          <button className="rounded-xl p-2 text-slate-300 md:hidden" onClick={() => setOpen((value) => !value)} aria-label="Toggle menu">{open ? <X /> : <Menu />}</button>
        </div>
        {open ? <div className="border-t border-white/10 p-3 md:hidden"><div className="mx-auto grid max-w-7xl gap-1">{nav.map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl px-4 py-3 font-bold text-slate-200 hover:bg-white/5"><Icon className="h-4 w-4" />{label}</Link>)}<Link href="/admin" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl px-4 py-3 font-bold text-amber-200 hover:bg-white/5"><ShieldCheck className="h-4 w-4" />Control centre</Link><button onClick={signOut} className="flex items-center gap-3 rounded-xl px-4 py-3 text-left font-bold text-rose-300"><LogOut className="h-4 w-4" />Log out</button></div></div> : null}
      </header>
      {children}
      {showDock ? <nav aria-label="Mobile navigation" className="mobile-dock-safe fixed inset-x-3 z-50 mx-auto max-w-md rounded-2xl border border-white/10 bg-slate-950/95 p-2 shadow-2xl shadow-black/60 backdrop-blur-xl md:hidden"><div className="grid grid-cols-5 items-end"><Dock href="/dashboard" label="Home" icon={Home} active={pathname.startsWith('/dashboard')} /><Dock href="/transactions" label="Entries" icon={History} active={pathname === '/transactions'} /><Link href="/transactions/new" className="group -mt-7 flex flex-col items-center gap-1 text-[.65rem] font-black text-lime-300"><span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-lime-300 text-slate-950 shadow-lg shadow-lime-300/25 group-active:scale-95"><Plus className="h-7 w-7" /></span><span>Add</span></Link><Dock href="/ledger" label="Ledger" icon={BookOpen} active={pathname.startsWith('/ledger')} /><Dock href="/admin" label="Control" icon={UserRound} active={pathname.startsWith('/admin')} /></div></nav> : null}
    </>
  );
}

function Dock({ href, label, icon: Icon, active }: { href: string; label: string; icon: React.ComponentType<{ className?: string }>; active: boolean }) {
  return <Link href={href} className={`flex min-w-0 flex-col items-center gap-1 rounded-xl py-2 text-[.65rem] font-bold ${active ? 'text-lime-300' : 'text-slate-500'}`}><Icon className="h-5 w-5" /><span>{label}</span><span className={`h-1 w-1 rounded-full ${active ? 'bg-lime-300 shadow-[0_0_8px_rgba(163,230,53,.9)]' : ''}`} /></Link>;
}
