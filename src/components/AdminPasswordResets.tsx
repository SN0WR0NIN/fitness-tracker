'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, Clock3, Copy, KeyRound, RotateCcw, XCircle } from 'lucide-react';

type ResetStatus = 'OPEN' | 'ISSUED' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';
type ResetRequest = {
  id: string;
  userId: string;
  status: ResetStatus;
  requestCount: number;
  requestedAt: string;
  lastRequestedAt: string;
  issuedAt: string | null;
  expiresAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  issuedByName: string | null;
  user: { id: string; name: string; username: string | null; email: string; columnName: string | null };
};

type Credentials = { requestId: string; participantName: string; login: string; temporaryPassword: string; expiresAt: string };

export default function AdminPasswordResets({ initialRequests }: { initialRequests: ResetRequest[] }) {
  const router = useRouter();
  const [requests, setRequests] = useState(initialRequests);
  const [tab, setTab] = useState<'ACTIVE' | 'HISTORY'>('ACTIVE');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [credentials, setCredentials] = useState<Credentials | null>(null);

  const activeCount = requests.filter((request) => ['OPEN','ISSUED'].includes(request.status)).length;
  const visible = useMemo(() => requests.filter((request) => tab === 'ACTIVE' ? ['OPEN','ISSUED'].includes(request.status) : !['OPEN','ISSUED'].includes(request.status)), [requests, tab]);

  async function action(request: ResetRequest, type: 'ISSUE' | 'CANCEL') {
    if (type === 'CANCEL' && !window.confirm(`Cancel ${request.user.name}'s password reset request?`)) return;
    setBusyId(request.id);
    setMessage('');
    setCredentials(null);
    try {
      const response = await fetch('/api/admin/password-resets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: request.id, action: type }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Request failed.');
      if (type === 'ISSUE') {
        setCredentials(data);
        setRequests((current) => current.map((item) => item.id === request.id ? { ...item, status: 'ISSUED', issuedAt: new Date().toISOString(), expiresAt: data.expiresAt } : item));
        setMessage(`Temporary reset credentials created for ${request.user.name}.`);
      } else {
        setRequests((current) => current.map((item) => item.id === request.id ? { ...item, status: 'CANCELLED', cancelledAt: new Date().toISOString() } : item));
        setMessage('Reset request cancelled.');
      }
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Request failed.');
    } finally {
      setBusyId(null);
    }
  }

  async function copyCredentials() {
    if (!credentials) return;
    await navigator.clipboard.writeText(`KG Stay Active password reset\nLogin: ${credentials.login}\nTemporary reset password: ${credentials.temporaryPassword}\nReset page: https://kg-stay-active-challenge.vercel.app/auth/reset-password\nExpires: ${new Date(credentials.expiresAt).toLocaleString('en-SG', { timeZone: 'Asia/Singapore' })} SGT`);
    setMessage('Reset instructions copied.');
  }

  return (
    <main className="mx-auto min-h-screen max-w-5xl space-y-6 px-4 py-8 text-white sm:px-6">
      <div><Link href="/admin" className="text-orange-300">← Command Centre</Link><h1 className="mt-4 text-3xl font-black sm:text-4xl">Password reset requests</h1><p className="mt-2 max-w-3xl text-slate-400">Participants request help from the login page. Issue a temporary reset password only after you are comfortable that the request belongs to the named participant. Issuing a reset invalidates their existing signed-in sessions.</p></div>

      {credentials ? <section className="rounded-2xl border border-amber-300/40 bg-amber-300/10 p-5"><div className="flex items-start gap-3"><KeyRound className="mt-1 h-5 w-5 shrink-0 text-amber-300" /><div className="min-w-0 flex-1"><h2 className="font-black text-amber-200">Temporary reset credentials — shown once</h2><p className="mt-3">Participant: <strong>{credentials.participantName}</strong></p><p className="mt-1 break-all">Login: <code>{credentials.login}</code></p><p className="mt-1 break-all">Temporary password: <code>{credentials.temporaryPassword}</code></p><p className="mt-1 text-sm text-slate-300">Expires {new Date(credentials.expiresAt).toLocaleString('en-SG', { timeZone: 'Asia/Singapore' })} SGT</p><p className="mt-3 text-sm text-slate-400">Share privately. The participant must open <strong>/auth/reset-password</strong> and replace this password. Do not post it in the group chat.</p><div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => void copyCredentials()} className="flex min-h-11 items-center gap-2 rounded-xl bg-amber-300 px-4 font-bold text-slate-950"><Copy className="h-4 w-4" />Copy instructions</button><button type="button" onClick={() => setCredentials(null)} className="min-h-11 rounded-xl border border-white/20 px-4">Hide credentials</button></div></div></div></section> : null}

      {message ? <p role="status" className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm">{message}</p> : null}

      <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
        <div className="flex gap-2"><button type="button" onClick={() => setTab('ACTIVE')} className={`rounded-xl px-4 py-2.5 text-sm font-bold ${tab === 'ACTIVE' ? 'bg-orange-500' : 'bg-black/20 text-slate-400'}`}>Active <span className="ml-1 opacity-70">{activeCount}</span></button><button type="button" onClick={() => setTab('HISTORY')} className={`rounded-xl px-4 py-2.5 text-sm font-bold ${tab === 'HISTORY' ? 'bg-orange-500' : 'bg-black/20 text-slate-400'}`}>History</button></div>
      </section>

      <section className="space-y-3">
        {visible.length ? visible.map((request) => {
          const issuedActive = request.status === 'ISSUED' && Boolean(request.expiresAt && Date.parse(request.expiresAt) > Date.now());
          return <article key={request.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Link href={`/participants/${request.user.id}`} className="text-lg font-black hover:text-orange-300">{request.user.name}</Link><Status status={request.status} /></div><p className="mt-1 text-sm text-slate-400">{request.user.columnName || 'No column'} · {request.user.username || 'Email login'}</p><p className="mt-2 text-xs text-slate-500">Requested {new Date(request.lastRequestedAt).toLocaleString('en-SG', { timeZone: 'Asia/Singapore' })} SGT{request.requestCount > 1 ? ` · ${request.requestCount} requests` : ''}</p>{request.status === 'ISSUED' && request.expiresAt ? <p className={`mt-1 text-xs ${issuedActive ? 'text-amber-300' : 'text-rose-300'}`}>Reset password {issuedActive ? 'expires' : 'expired'} {new Date(request.expiresAt).toLocaleString('en-SG', { timeZone: 'Asia/Singapore' })} SGT{request.issuedByName ? ` · issued by ${request.issuedByName}` : ''}</p> : null}</div>{['OPEN','ISSUED'].includes(request.status) ? <div className="flex flex-wrap gap-2"><button disabled={busyId === request.id} type="button" onClick={() => void action(request, 'ISSUE')} className="flex min-h-11 items-center gap-2 rounded-xl bg-orange-500 px-4 text-sm font-bold disabled:opacity-50">{request.status === 'ISSUED' ? <RotateCcw className="h-4 w-4" /> : <KeyRound className="h-4 w-4" />}{request.status === 'ISSUED' ? 'Reissue reset' : 'Issue reset'}</button><button disabled={busyId === request.id} type="button" onClick={() => void action(request, 'CANCEL')} className="min-h-11 rounded-xl border border-white/20 px-4 text-sm">Cancel</button></div> : null}</div></article>;
        }) : <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-slate-500">{tab === 'ACTIVE' ? 'No active password reset requests.' : 'No password reset history yet.'}</div>}
      </section>
    </main>
  );
}

function Status({ status }: { status: ResetStatus }) {
  const styles: Record<ResetStatus, string> = { OPEN: 'bg-sky-400/10 text-sky-300', ISSUED: 'bg-amber-400/10 text-amber-300', COMPLETED: 'bg-emerald-400/10 text-emerald-300', CANCELLED: 'bg-slate-400/10 text-slate-400', EXPIRED: 'bg-rose-400/10 text-rose-300' };
  const Icon = status === 'COMPLETED' ? CheckCircle2 : status === 'CANCELLED' || status === 'EXPIRED' ? XCircle : Clock3;
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${styles[status]}`}><Icon className="h-3.5 w-3.5" />{status.charAt(0) + status.slice(1).toLowerCase()}</span>;
}
