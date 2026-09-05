'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function routeSession(userId: string) {
    const { data: access } = await supabase.from('edo_access').select('role').eq('user_id', userId).maybeSingle();
    router.replace(access ? '/dashboard' : '/setup');
    router.refresh();
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) routeSession(data.session.user.id);
    });
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setLoading(false);
      setError(signInError.message);
      return;
    }
    if (!data.user) {
      setLoading(false);
      setError('Unable to load the signed-in account.');
      return;
    }
    await routeSession(data.user.id);
    setLoading(false);
  }

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 flex items-center justify-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-lime-300 font-black text-slate-950">KG</span>
          <div><div className="text-xs font-black uppercase tracking-[.22em] text-lime-300">Kilo Golf</div><div className="font-black">EDO Tracker</div></div>
        </Link>
        <form onSubmit={submit} className="glass-card rounded-3xl p-6 sm:p-8">
          <h1 className="text-2xl font-black">Sign in</h1>
          <p className="mt-2 text-sm text-slate-400">Use the email linked to your officer account.</p>
          <label className="mt-6 block text-xs font-black uppercase tracking-[.15em] text-slate-400">Email
            <div className="mt-2 flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/70 px-3"><Mail className="h-4 w-4 text-slate-500"/><input className="w-full bg-transparent py-3 outline-none" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required/></div>
          </label>
          <label className="mt-4 block text-xs font-black uppercase tracking-[.15em] text-slate-400">Password
            <div className="mt-2 flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/70 px-3"><LockKeyhole className="h-4 w-4 text-slate-500"/><input className="w-full bg-transparent py-3 outline-none" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required/></div>
          </label>
          {error ? <div className="mt-4 rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-200">{error}</div> : null}
          <button disabled={loading} className="mt-6 w-full rounded-2xl bg-lime-300 px-4 py-3 font-black text-slate-950 disabled:opacity-60">{loading ? 'Signing in…' : 'Sign in'}</button>
          <Link href="/setup" className="mt-4 flex items-center justify-center gap-2 text-xs font-bold text-slate-500 hover:text-amber-200"><ShieldCheck className="h-3.5 w-3.5"/>First-time system setup</Link>
        </form>
      </div>
    </main>
  );
}
