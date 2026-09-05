'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { ArrowLeft, Check, Clipboard, KeyRound, Plus, UserCheck, UserRoundPlus } from 'lucide-react';
import AppShell from '@/components/AppShell';
import { useEdoAccount } from '@/hooks/useEdoAccount';
import { supabase } from '@/lib/supabase';
import type { EdoOfficer, EdoRole } from '@/lib/types';

type InviteRow = {
  id: string;
  officer_id: string;
  role: EdoRole;
  column_code: string;
  invite_email: string | null;
  expires_at: string;
  claimed_by: string | null;
  claimed_at: string | null;
  created_at: string;
};

export default function OfficersPage() {
  const { access, loading, error } = useEdoAccount();
  const [officers, setOfficers] = useState<EdoOfficer[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [fullName, setFullName] = useState('');
  const [rank, setRank] = useState('');
  const [officerNo, setOfficerNo] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<EdoRole>('OFFICER');
  const [startingBalance, setStartingBalance] = useState('0');
  const [startingBalanceDate, setStartingBalanceDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [copied, setCopied] = useState(false);

  async function load() {
    if (!access || access.role === 'OFFICER') return;
    const [officerResult, inviteResult] = await Promise.all([
      supabase.from('edo_officers').select('*').order('full_name'),
      supabase.from('edo_invites').select('id,officer_id,role,column_code,invite_email,expires_at,claimed_by,claimed_at,created_at').order('created_at', { ascending: false }).limit(100),
    ]);
    setOfficers((officerResult.data as EdoOfficer[]) ?? []);
    setInvites((inviteResult.data as InviteRow[]) ?? []);
  }

  useEffect(() => { load(); }, [access]);

  async function createInvite(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setMessage(''); setJoinCode(''); setCopied(false);
    const { data, error: invokeError } = await supabase.functions.invoke('edo-admin', {
      body: {
        action: 'create_officer_invite',
        full_name: fullName,
        rank: rank || undefined,
        officer_no: officerNo || undefined,
        invite_email: email || undefined,
        role,
        starting_balance: Number(startingBalance || 0),
        starting_balance_date: startingBalanceDate || undefined,
      },
    });
    setBusy(false);
    if (invokeError) { setMessage(invokeError.message); return; }
    if (data?.error) { setMessage(data.error); return; }
    setJoinCode(data.code ?? '');
    setMessage(`${fullName} was created. Share the one-time join code below.`);
    setFullName(''); setRank(''); setOfficerNo(''); setEmail(''); setRole('OFFICER'); setStartingBalance('0'); setStartingBalanceDate('');
    await load();
  }

  async function copyCode() {
    if (!joinCode) return;
    await navigator.clipboard.writeText(joinCode);
    setCopied(true);
  }

  const inviteForOfficer = new Map(invites.map((invite) => [invite.officer_id, invite]));

  return (
    <AppShell>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        {loading ? <Card text="Loading officer management…" /> : error ? <Card text={error} /> : access?.role === 'OFFICER' ? <Card text="Officer management is limited to supervisors and admins." /> : <>
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div><Link href="/admin" className="mb-3 inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-white"><ArrowLeft className="h-3.5 w-3.5" />Control centre</Link><div className="text-xs font-black uppercase tracking-[.2em] text-amber-300">Access management</div><h1 className="mt-1 text-3xl font-black">Officers & join codes</h1><p className="mt-1 text-sm text-slate-500">Create an officer profile, then give that officer the generated one-time code.</p></div>
          </div>

          <section className="grid gap-6 xl:grid-cols-[.85fr_1.15fr]">
            <form onSubmit={createInvite} className="glass-card rounded-3xl p-5 sm:p-6">
              <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-lime-300/10 text-lime-300"><UserRoundPlus className="h-5 w-5" /></span><div><h2 className="font-black">Add officer</h2><p className="text-xs text-slate-500">The account remains unlinked until the code is claimed.</p></div></div>
              <Field label="Full name"><input required value={fullName} onChange={(e) => setFullName(e.target.value)} className="control" /></Field>
              <div className="grid gap-4 sm:grid-cols-2"><Field label="Rank"><input value={rank} onChange={(e) => setRank(e.target.value)} className="control" /></Field><Field label="Officer no."><input value={officerNo} onChange={(e) => setOfficerNo(e.target.value)} className="control" /></Field></div>
              <Field label="Email lock (recommended)"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="control" placeholder="Only this email can claim the code" /></Field>
              <div className="grid gap-4 sm:grid-cols-2"><Field label="Role"><select value={role} onChange={(e) => setRole(e.target.value as EdoRole)} className="control">{access?.role === 'ADMIN' ? <><option value="OFFICER">Officer</option><option value="SUPERVISOR">Supervisor</option><option value="ADMIN">Admin</option></> : <option value="OFFICER">Officer</option>}</select></Field><Field label="Starting balance"><input type="number" min="0" max="48" step="0.25" value={startingBalance} onChange={(e) => setStartingBalance(e.target.value)} className="control" /></Field></div>
              <Field label="Starting balance date"><input type="date" value={startingBalanceDate} onChange={(e) => setStartingBalanceDate(e.target.value)} className="control" /></Field>
              <button disabled={busy} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-lime-300 px-4 py-3 font-black text-slate-950 disabled:opacity-60"><Plus className="h-4 w-4" />{busy ? 'Creating…' : 'Create officer & join code'}</button>
              {message ? <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">{message}</div> : null}
              {joinCode ? <div className="mt-3 rounded-2xl border border-lime-300/25 bg-lime-300/10 p-4"><div className="text-[10px] font-black uppercase tracking-[.16em] text-lime-200">One-time join code</div><div className="mt-2 flex items-center gap-2"><code className="min-w-0 flex-1 break-all text-lg font-black tracking-[.1em] text-white">{joinCode}</code><button type="button" onClick={copyCode} className="rounded-xl bg-lime-300 p-2 text-slate-950" aria-label="Copy join code">{copied ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}</button></div><p className="mt-2 text-xs text-lime-100/70">The code is shown here only after creation. It expires after 14 days.</p></div> : null}
            </form>

            <div className="glass-card rounded-3xl p-5 sm:p-6">
              <div className="flex items-center justify-between"><div><h2 className="font-black">Officer directory</h2><p className="text-xs text-slate-500">{officers.length} profiles</p></div><UserCheck className="h-5 w-5 text-slate-500" /></div>
              <div className="mt-4 max-h-[44rem] divide-y divide-white/5 overflow-y-auto pr-1">{officers.length ? officers.map((officer) => { const invite = inviteForOfficer.get(officer.id); const linked = Boolean(officer.auth_user_id); const expired = invite ? new Date(invite.expires_at).getTime() <= Date.now() : false; return <div key={officer.id} className="flex items-center gap-3 py-3"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${linked ? 'bg-lime-300/10 text-lime-300' : 'bg-white/5 text-slate-500'}`}>{linked ? <UserCheck className="h-4 w-4" /> : <KeyRound className="h-4 w-4" />}</span><div className="min-w-0 flex-1"><div className="truncate font-bold">{officer.full_name}</div><div className="text-xs text-slate-500">{officer.rank ?? 'Officer'} · {officer.column_code}{officer.officer_no ? ` · ${officer.officer_no}` : ''}</div></div><div className="text-right"><div className={`text-[10px] font-black ${linked ? 'text-lime-300' : invite?.claimed_at ? 'text-lime-300' : expired ? 'text-rose-300' : invite ? 'text-amber-200' : 'text-slate-500'}`}>{linked ? 'LINKED' : expired ? 'EXPIRED' : invite ? 'INVITED' : 'UNLINKED'}</div><div className="mt-1 text-xs font-bold text-slate-400">{Number(officer.starting_balance).toFixed(1)}h start</div></div></div>; }) : <div className="py-10 text-center text-sm text-slate-500">No officers created yet.</div>}</div>
            </div>
          </section>
        </>}
      </main>
      <style jsx>{`.control{margin-top:.5rem;width:100%;border-radius:1rem;border:1px solid rgba(255,255,255,.1);background:rgba(2,6,23,.8);padding:.75rem;outline:none}.control:focus{border-color:rgba(190,242,100,.55)}`}</style>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="mt-4 block text-xs font-black uppercase tracking-[.14em] text-slate-400">{label}{children}</label>; }
function Card({ text }: { text: string }) { return <div className="glass-card rounded-3xl p-6 text-sm text-slate-300">{text}</div>; }
