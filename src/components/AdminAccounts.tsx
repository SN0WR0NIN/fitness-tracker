'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
type Account = { id: string; name: string; columnId: string | null; username: string | null; pendingEmail: string | null; mustChangePassword: boolean; canProvision: boolean; role: string; unclaimed: boolean; temporaryPasswordExpiresAt: string | null };
export default function AdminAccounts({ users, columns }: { users: Account[]; columns: { id: string; name: string }[] }) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  const statusOf = (user: Account) => user.unclaimed ? 'Unclaimed' : !user.mustChangePassword ? 'Ready' : (!user.temporaryPasswordExpiresAt || (now !== null && Date.parse(user.temporaryPasswordExpiresAt) <= now)) ? 'Expired' : 'Setup pending';
  const members = users.filter((user) => user.role === 'MEMBER');
  const filtered = members.filter((user) => (statusFilter === 'All' || statusOf(user) === statusFilter) && `${user.name} ${user.username ?? ''} ${columns.find((column) => column.id === user.columnId)?.name ?? ''}`.toLowerCase().includes(search.toLowerCase().trim()));
  const selectParticipant = (user: Account) => {
    setUserId(user.id); setName(user.name); setUsername(user.username ?? ''); setColumnId(user.columnId ?? ''); setCredentials(null);
    document.getElementById('provision-account')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const [userId, setUserId] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [columnId, setColumnId] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [credentials, setCredentials] = useState<{ username: string; temporaryPassword: string; expiresAt: string } | null>(null);
  async function provision(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage(''); setCredentials(null);
    try {
      const response = await fetch('/api/admin/accounts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: userId || undefined, name, username, columnId }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setCredentials(data); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Request failed.'); }
    finally { setBusy(false); }
  }
  async function review(user: Account, approve: boolean) {
    if (approve && !window.confirm(`Confirm you checked that ${user.pendingEmail} belongs to ${user.name}. This will become their login email.`)) return;
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/admin/accounts', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id, pendingEmail: user.pendingEmail, approve }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setMessage(approve ? 'Email confirmed by admin.' : 'Email request rejected.'); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Request failed.'); }
    finally { setBusy(false); }
  }
  const field = 'mt-2 w-full rounded-xl border border-white/20 bg-slate-900 p-3 text-white';
  return <main className="mx-auto min-h-screen max-w-3xl space-y-6 px-4 py-8 text-white"><Link href="/admin/users" className="text-orange-300">← Manage users</Link><h1 className="text-3xl font-bold">Participant accounts</h1><p className="text-slate-300">Activate an imported record to keep its progress, or create a new member. Existing activated accounts cannot be reset here.</p>{message ? <p role="status">{message}</p> : null}
    <section aria-labelledby="activation-title" className="space-y-4 rounded-2xl border border-white/10 bg-slate-950/40 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="activation-title" className="text-xl font-bold">Account activation tracker</h2><button type="button" onClick={() => { setNow(Date.now()); router.refresh(); }} className="min-h-11 rounded-lg border border-white/20 px-4">Refresh</button></div>
      <p className="text-sm text-slate-400">{members.length} participant accounts. Ready means registration or password setup is complete; it does not confirm a recent sign-in.</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{['Ready', 'Setup pending', 'Expired', 'Unclaimed'].map((status) => <button type="button" key={status} aria-pressed={statusFilter === status} onClick={() => setStatusFilter(statusFilter === status ? 'All' : status)} className={`rounded-xl border p-3 text-left ${statusFilter === status ? 'border-orange-400 bg-orange-400/10' : 'border-white/10 bg-white/5'}`}><span className="block text-2xl font-bold">{now === null ? '—' : members.filter((user) => statusOf(user) === status).length}</span><span className="text-sm">{status}</span></button>)}</div>
      <div className="grid gap-3 sm:grid-cols-2"><label>Find participant<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, username or Column" className={field} /></label><label>Account status<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={field}>{['All', 'Ready', 'Setup pending', 'Expired', 'Unclaimed'].map((status) => <option key={status}>{status}</option>)}</select></label></div>
      <div className="space-y-3">{now === null ? <p role="status">Loading account status…</p> : filtered.length === 0 ? <p>No participants match these filters.</p> : filtered.map((user) => <article key={user.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 p-4"><div className="min-w-0"><Link href={`/participants/${user.id}`} className="font-bold text-orange-200 hover:underline">{user.name}</Link><p className="break-words text-sm text-slate-400">{columns.find((column) => column.id === user.columnId)?.name ?? 'Unassigned'} · {user.username ?? 'No username'}</p><p className={`mt-1 text-sm font-semibold ${statusOf(user) === 'Ready' ? 'text-emerald-300' : statusOf(user) === 'Expired' ? 'text-rose-300' : 'text-amber-300'}`}>{statusOf(user)}</p>{user.mustChangePassword && user.temporaryPasswordExpiresAt ? <p className="mt-1 text-xs text-slate-400">Temporary access expires {new Date(user.temporaryPasswordExpiresAt).toLocaleString('en-SG', { timeZone: 'Asia/Singapore' })} SGT</p> : null}{user.pendingEmail ? <p className="text-xs text-amber-300">Email confirmation pending</p> : null}</div>{user.canProvision ? <button type="button" disabled={busy} onClick={() => selectParticipant(user)} className="min-h-11 rounded-lg border border-orange-400/40 px-3 text-sm text-orange-200">{user.unclaimed ? 'Prepare account' : 'Reissue credentials'}</button> : null}</article>)}</div>
    </section>
    {credentials ? <section className="space-y-3 rounded-xl border border-amber-400 p-5"><h2 className="font-bold">Temporary credentials — shown once</h2><p>Username: <strong>{credentials.username}</strong></p><p className="break-all">Temporary password: <code>{credentials.temporaryPassword}</code></p><p>Expires: {new Date(credentials.expiresAt).toLocaleString('en-SG', { timeZone: 'Asia/Singapore' })} SGT</p><p>Share privately with this participant. They must replace this password at first login. Reissuing credentials invalidates the previous password.</p><button onClick={() => setCredentials(null)} className="rounded-lg border p-2">I’ve recorded it — hide credentials</button></section> : null}
    <form id="provision-account" onSubmit={provision} className="space-y-4 rounded-xl border border-white/10 p-5"><label className="block">Participant<select disabled={busy} value={userId} onChange={(event) => { const selected = users.find((user) => user.id === event.target.value); setUserId(event.target.value); setName(selected?.name ?? ''); setUsername(selected?.username ?? ''); setColumnId(selected?.columnId ?? ''); setCredentials(null); }} className={field}><option value="">Create a new member</option>{users.filter((user) => user.canProvision).map((user) => <option key={user.id} value={user.id}>{user.name} {user.mustChangePassword ? '(awaiting first login)' : '(unclaimed)'}</option>)}</select></label><label className="block">Name<input required disabled={Boolean(userId)} value={name} onChange={(event) => setName(event.target.value)} className={field} /></label><label className="block">Column<select required disabled={Boolean(userId)} value={columnId} onChange={(event) => setColumnId(event.target.value)} className={field}><option value="">Choose column</option>{columns.map((column) => <option key={column.id} value={column.id}>{column.name}</option>)}</select></label><label className="block">Username<input required pattern="[a-z0-9][a-z0-9._\-]{2,29}" autoComplete="off" value={username} onChange={(event) => setUsername(event.target.value.toLowerCase())} className={field} /><span className="text-xs text-slate-400">3–30 lowercase letters, numbers, dots, underscores or hyphens</span></label><button disabled={busy} className="rounded-xl bg-orange-500 p-3 font-bold disabled:opacity-40">{busy ? 'Saving…' : 'Generate temporary credentials'}</button></form>
    <section className="space-y-4"><h2 className="text-xl font-bold">Email requests</h2>{users.filter((user) => user.pendingEmail).length === 0 ? <p>No pending email requests.</p> : users.filter((user) => user.pendingEmail).map((user) => <article key={user.id} className="space-y-3 rounded-xl border border-white/10 p-4"><p className="break-words"><strong>{user.name}</strong> ({user.username ?? 'email login'})<br />{user.pendingEmail}<br /><span className="text-amber-300">Unverified — awaiting admin confirmation</span></p><button disabled={busy} onClick={() => void review(user, true)} className="mr-3 rounded-lg bg-orange-500 p-3">Confirm email</button><button disabled={busy} onClick={() => void review(user, false)} className="rounded-lg border p-3">Reject request</button></article>)}</section>
  </main>;
}
