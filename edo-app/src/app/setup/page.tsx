'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { KeyRound, ShieldCheck, UserPlus } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function SetupPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [setupKey, setSetupKey] = useState('');
  const [fullName, setFullName] = useState('');
  const [rank, setRank] = useState('');
  const [officerNo, setOfficerNo] = useState('');
  const [startingBalance, setStartingBalance] = useState('0');
  const [startingBalanceDate, setStartingBalanceDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const session = data.session;
      setSignedIn(Boolean(session));
      if (session) {
        setEmail(session.user.email ?? '');
        const savedName = typeof session.user.user_metadata?.full_name === 'string' ? session.user.user_metadata.full_name : '';
        if (savedName) setFullName(savedName);
        const { data: access } = await supabase.from('edo_access').select('role').eq('user_id', session.user.id).maybeSingle();
        if (access) router.replace('/dashboard');
      }
      setReady(true);
    });
  }, [router]);

  async function activate() {
    if (!setupKey.trim()) { setMessage('Owner setup key is required.'); return; }
    setBusy(true); setMessage('');
    const { data, error } = await supabase.functions.invoke('edo-bootstrap', {
      body: {
        setup_code: setupKey,
        full_name: fullName,
        rank: rank || undefined,
        officer_no: officerNo || undefined,
        starting_balance: Number(startingBalance || 0),
        starting_balance_date: startingBalanceDate || undefined,
      },
    });
    setBusy(false);
    if (error) { setMessage(error.message); return; }
    if (data?.error) { setMessage(data.error); return; }
    setSetupKey('');
    router.replace('/dashboard');
    router.refresh();
  }

  async function createAccount(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setMessage('');
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } });
    if (error) { setBusy(false); setMessage(error.message); return; }
    if (!data.session) {
      setBusy(false);
      setMessage('Account created. Confirm your email if prompted, then sign in and return here to finish setup.');
      return;
    }
    setSignedIn(true);
    await activate();
  }

  if (!ready) return <main className="grid min-h-screen place-items-center px-4 text-sm text-slate-400">Checking setup status…</main>;

  return <main className="min-h-screen px-4 py-10 sm:px-6"><div className="mx-auto max-w-xl">
    <Link href="/" className="mb-8 flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-lime-300 font-black text-slate-950">KG</span><div><div className="text-xs font-black uppercase tracking-[.22em] text-lime-300">Kilo Golf</div><div className="font-black">EDO Tracker Setup</div></div></Link>
    <div className="glass-card rounded-3xl p-6 sm:p-8"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-300/10 text-amber-200"><ShieldCheck /></div><h1 className="mt-5 text-2xl font-black">Initial administrator</h1><p className="mt-2 text-sm leading-6 text-slate-400">This route works only once and requires the owner setup key. After activation, officer and supervisor access is issued through one-time join codes.</p>
      {!signedIn ? <form onSubmit={createAccount} className="mt-6 space-y-4"><Field label="Owner setup key"><input required value={setupKey} onChange={(e) => setSetupKey(e.target.value)} className="control" autoComplete="off" /></Field><Field label="Full name"><input required value={fullName} onChange={(e) => setFullName(e.target.value)} className="control" /></Field><Field label="Email"><input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="control" /></Field><Field label="Password"><input required minLength={8} type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="control" /></Field><button disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-lime-300 px-4 py-3 font-black text-slate-950 disabled:opacity-60"><UserPlus className="h-4 w-4" />{busy ? 'Creating…' : 'Create first admin account'}</button></form> : <div className="mt-6 space-y-4"><div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm"><div className="text-xs font-black uppercase tracking-[.14em] text-slate-500">Signed in as</div><div className="mt-1 font-bold">{email}</div></div><Field label="Owner setup key"><input required value={setupKey} onChange={(e) => setSetupKey(e.target.value)} className="control" autoComplete="off" /></Field><Field label="Full name"><input required value={fullName} onChange={(e) => setFullName(e.target.value)} className="control" /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Rank"><input value={rank} onChange={(e) => setRank(e.target.value)} className="control" /></Field><Field label="Officer no."><input value={officerNo} onChange={(e) => setOfficerNo(e.target.value)} className="control" /></Field></div><div className="grid gap-4 sm:grid-cols-2"><Field label="Starting balance"><input type="number" min="0" max="48" step="0.25" value={startingBalance} onChange={(e) => setStartingBalance(e.target.value)} className="control" /></Field><Field label="Effective date"><input type="date" value={startingBalanceDate} onChange={(e) => setStartingBalanceDate(e.target.value)} className="control" /></Field></div><button type="button" disabled={busy || !fullName.trim() || !setupKey.trim()} onClick={activate} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-lime-300 px-4 py-3 font-black text-slate-950 disabled:opacity-60"><KeyRound className="h-4 w-4" />{busy ? 'Activating…' : 'Activate initial administrator'}</button></div>}
      {message ? <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">{message}</div> : null}
    </div>
  </div><style jsx>{`.control{margin-top:.5rem;width:100%;border-radius:1rem;border:1px solid rgba(255,255,255,.1);background:rgba(2,6,23,.8);padding:.75rem;outline:none}.control:focus{border-color:rgba(190,242,100,.55)}`}</style></main>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-xs font-black uppercase tracking-[.14em] text-slate-400">{label}{children}</label>; }
