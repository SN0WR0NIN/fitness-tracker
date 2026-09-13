'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Clock3, MailCheck, XCircle } from 'lucide-react';

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
  emailSentAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  issuedByName: string | null;
  user: { id: string; name: string; username: string | null; email: string; columnName: string | null };
};

export default function AdminPasswordResets({ initialRequests }: { initialRequests: ResetRequest[] }) {
  const [tab, setTab] = useState<'ACTIVE' | 'HISTORY'>('ACTIVE');
  const activeCount = initialRequests.filter((request) => request.status === 'ISSUED').length;
  const visible = useMemo(
    () => initialRequests.filter((request) => tab === 'ACTIVE' ? request.status === 'ISSUED' : request.status !== 'ISSUED'),
    [initialRequests, tab],
  );

  return (
    <main className="mx-auto min-h-screen max-w-5xl space-y-6 px-4 py-8 text-white sm:px-6">
      <div><Link href="/admin" className="text-orange-300">← Command Centre</Link><h1 className="mt-4 text-3xl font-black sm:text-4xl">Password reset emails</h1><p className="mt-2 max-w-3xl text-slate-400">Participants can request a secure one-time link from the login page. Admins can send the same link from Participant accounts after confirming the participant&apos;s email.</p></div>

      <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
        <div className="flex gap-2"><button type="button" onClick={() => setTab('ACTIVE')} className={`rounded-xl px-4 py-2.5 text-sm font-bold ${tab === 'ACTIVE' ? 'bg-orange-500' : 'bg-black/20 text-slate-400'}`}>Active <span className="ml-1 opacity-70">{activeCount}</span></button><button type="button" onClick={() => setTab('HISTORY')} className={`rounded-xl px-4 py-2.5 text-sm font-bold ${tab === 'HISTORY' ? 'bg-orange-500' : 'bg-black/20 text-slate-400'}`}>History</button></div>
      </section>

      <section className="space-y-3">
        {visible.length ? visible.map((request) => <article key={request.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Link href={`/participants/${request.user.id}`} className="text-lg font-black hover:text-orange-300">{request.user.name}</Link><Status status={request.status} /></div><p className="mt-1 break-all text-sm text-slate-400">{request.user.email} · {request.user.columnName || 'No column'}</p><p className="mt-2 text-xs text-slate-500">Sent {formatSg(request.emailSentAt || request.issuedAt || request.requestedAt)}{request.issuedByName ? ` by ${request.issuedByName}` : ' from self-service'}</p>{request.status === 'ISSUED' && request.expiresAt ? <p className="mt-1 text-xs text-amber-300">Expires {formatSg(request.expiresAt)}</p> : null}{request.completedAt ? <p className="mt-1 text-xs text-emerald-300">Completed {formatSg(request.completedAt)}</p> : null}</div></div></article>) : <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-slate-500">{tab === 'ACTIVE' ? 'No active password reset links.' : 'No password reset history yet.'}</div>}
      </section>
    </main>
  );
}

function formatSg(value: string) {
  return new Date(value).toLocaleString('en-SG', { timeZone: 'Asia/Singapore' }) + ' SGT';
}

function Status({ status }: { status: ResetStatus }) {
  const styles: Record<ResetStatus, string> = { OPEN: 'bg-sky-400/10 text-sky-300', ISSUED: 'bg-amber-400/10 text-amber-300', COMPLETED: 'bg-emerald-400/10 text-emerald-300', CANCELLED: 'bg-slate-400/10 text-slate-400', EXPIRED: 'bg-rose-400/10 text-rose-300' };
  const labels: Record<ResetStatus, string> = { OPEN: 'Pending', ISSUED: 'Email sent', COMPLETED: 'Completed', CANCELLED: 'Cancelled', EXPIRED: 'Expired' };
  const Icon = status === 'COMPLETED' ? CheckCircle2 : status === 'ISSUED' ? MailCheck : status === 'CANCELLED' || status === 'EXPIRED' ? XCircle : Clock3;
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${styles[status]}`}><Icon className="h-3.5 w-3.5" />{labels[status]}</span>;
}
