'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { KeyRound, LockKeyhole, Mail, ShieldCheck, UserRoundPlus } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function JoinPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const savedCode = window.localStorage.getItem('edo_join_code') ?? '';
    if (savedCode) setCode(savedCode);
    supabase.auth.getSession().then(async ({ data }) => {
      const session = data.session;
      setSignedIn(Boolean(session));
      if (session) {
        setEmail(session.user.email ?? '');
        const { data: access } = await supabase.from('edo_access').select('role').eq('user_id', session.user.id).maybeSingle();
        if (access) router.replace('/dashboard');
      }
      setReady(true);
    });
  }, [router]);

  async function claim(joinCode = code) {
    if (!joinCode.trim()) { setMessage('Enter the join code provided by your EDO administrator.'); return; }
    setBusy(true); setMessage(''); setSuccess(false);
    const { data, error } = await supabase.functions.invoke('edo-join', { body: { code: joinCode.trim() } });
    setBusy(false);
    if (error) { setMessage(error.message); return; }
    if (data?.error) { setMessage(data.error); return; }
    window.localStorage.removeItem('edo_join_code');
    setSuccess(true);
    setMessage('Officer account linked successfully.');
    router.replace('/dashboard');
    router.refresh();
  }

  async function createAccount(event: FormEvent) {
    event.preventDefault();
    if (!code.trim()) { setMessage('A join code is required.'); return; }
    setBusy(true); setMessage(''); setSuccess(false);
    window.localStorage.setItem('edo_join_code', code.trim().toUpperCase());
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) { setBusy(false); setMessage(error.message); return; }
    if (!data.session) {
      setBusy(false);
      setSuccess(true);
      setMessage('Account created. Confirm your email if prompted, then sign in. Your join code is saved on this device.');
      return;
    }
    setSignedIn(true);
    await claim(code);
  }

  if (!ready) return <main className="grid min-h-screen place-items-center px-4 text-sm text-slate-400">Checking account…</main>;

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 flex items-center justify-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-lime-300 font-black text-slate-950">KG</span><div><div className="text-xs font-black uppercase tracking-[.22em] text-lime-300">Kilo Golf</div><div className="font-black">Join EDO Tracker</div></div></Link>
        <div className="glass-card rounded-3xl p-6 sm:p-8">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-lime-300/10 text-lime-300"><UserRoundPlus /></div>
          <h1 className="mt-5 text-2xl font-black">Link your officer account</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">Use the one-time code issued from the EDO Control Centre. A code can be used once and expires automatically.</p>

          {!signedIn ? <form onSubmit={createAccount} className="mt-6 space-y-4"><Field label="Email"><div className="control-row"><Mail className="h-4 w-4 text-slate-500"/><input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="control-input"/></div></Field><Field label="Password"><div className="control-row"><LockKeyhole className="h-4 w-4 text-slate-500"/><input required minLength={8} type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="control-input"/></div></Field><Field label="Join code"><div className="control-row"><KeyRound className="h-4 w-4 text-lime-300"/><input required value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} className="control-input font-black tracking-[.12em]" placeholder="KG-XXXXXXXXXX"/></div></Field><button disabled={busy} className="w-full rounded-2xl bg-lime-300 px-4 py-3 font-black text-slate-950 disabled:opacity-60">{busy ? 'Creating…' : 'Create account & join'}</button><div className="text-center text-xs text-slate-500">Already have an account? <Link href="/login" className="font-bold text-lime-300">Sign in</Link></div></form> : <div className="mt-6 space-y-4"><div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm"><div className="text-xs font-black uppercase tracking-[.14em] text-slate-500">Signed in as</div><div className="mt-1 font-bold">{email}</div></div><Field label="Join code"><div className="control-row"><KeyRound className="h-4 w-4 text-lime-300"/><input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} className="control-input font-black tracking-[.12em]" placeholder="KG-XXXXXXXXXX"/></div></Field><button disabled={busy} onClick={() => claim()} className="w-full rounded-2xl bg-lime-300 px-4 py-3 font-black text-slate-950 disabled:opacity-60">{busy ? 'Linking…' : 'Link officer account'}</button><button onClick={() => supabase.auth.signOut().then(() => { setSignedIn(false); setEmail(''); })} className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-300">Use another account</button></div>}

          {message ? <div className={`mt-5 rounded-2xl border px-4 py-3 text-sm ${success ? 'border-lime-300/20 bg-lime-300/10 text-lime-100' : 'border-rose-300/20 bg-rose-300/10 text-rose-100'}`}>{message}</div> : null}
          <Link href="/setup" className="mt-5 flex items-center justify-center gap-2 text-xs font-bold text-slate-600 hover:text-amber-200"><ShieldCheck className="h-3.5 w-3.5"/>Initial administrator setup</Link>
        </div>
      </div>
      <style jsx>{`.control-row{margin-top:.5rem;display:flex;align-items:center;gap:.5rem;border:1px solid rgba(255,255,255,.1);border-radius:1rem;background:rgba(2,6,23,.8);padding:0 .75rem}.control-input{width:100%;background:transparent;padding:.75rem 0;outline:none}`}</style>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-xs font-black uppercase tracking-[.14em] text-slate-400">{label}{children}</label>; }
