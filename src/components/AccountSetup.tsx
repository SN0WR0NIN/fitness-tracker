'use client';
import { useEffect, useState } from 'react';
import { signOut } from 'next-auth/react';
import Link from 'next/link';

export default function AccountSetup({ firstLogin = false }: { firstLogin?: boolean }) {
  const [identifier, setIdentifier] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!firstLogin) fetch('/api/account/settings').then(async (response) => {
      if (!response.ok) throw new Error('Sign in to manage your account.');
      const data = await response.json();
      setIdentifier(data.username || data.email);
      setEmail(data.pendingEmail || (data.email.endsWith('.invalid') ? '' : data.email));
      setMessage(data.pendingEmail ? 'Your email is awaiting admin confirmation. Continue using your username or current login email.' : data.emailConfirmedAt ? 'Your email has been confirmed by an admin.' : 'Email changes require admin confirmation.');
    }).catch((error) => setMessage(error.message));
  }, [firstLogin]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (newPassword !== confirmation) { setMessage('The new passwords do not match.'); return; }
    setBusy(true); setMessage('');
    try {
      const response = await fetch(firstLogin ? '/api/account/setup' : '/api/account/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier, currentPassword, ...(newPassword ? { newPassword } : {}), email }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setCurrentPassword(''); setNewPassword(''); setConfirmation('');
      if (firstLogin) { setDone(true); setMessage(data.message); }
      else if (data.passwordChanged) await signOut({ callbackUrl: '/auth/login' });
      else setMessage('Email request saved. Continue using your current login until an admin confirms it.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Request failed.'); }
    finally { setBusy(false); }
  }
  const inputClass = 'mt-2 w-full rounded-xl border border-white/20 bg-slate-900 p-3 text-white';
  return <main className="mx-auto min-h-screen max-w-lg space-y-5 px-4 py-8 text-white"><Link href={firstLogin ? '/auth/login' : '/dashboard'} className="text-orange-300">← {firstLogin ? 'Log in' : 'Dashboard'}</Link><h1 className="text-3xl font-bold">{firstLogin ? 'Set up your account' : 'Account settings'}</h1><p className="text-slate-300">{firstLogin ? 'Enter your assigned username and temporary password, then choose your own password. Your existing progress stays with you.' : `Login: ${identifier}`}</p><p className="text-sm text-slate-400">Your email remains unverified until an admin confirms it. No verification emails or automatic password-reset emails are sent.</p>{message ? <p role="status" className="rounded-xl border border-orange-300/30 p-4">{message}</p> : null}{done ? <Link href="/auth/login" className="inline-block rounded-xl bg-orange-500 p-3">Log in with your new password</Link> : <form onSubmit={submit} className="space-y-4">{firstLogin ? <label className="block">Username<input required autoComplete="username" value={identifier} onChange={(event) => setIdentifier(event.target.value)} className={inputClass} /></label> : null}<label className="block">{firstLogin ? 'Temporary password' : 'Current password'}<input type="password" required autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className={inputClass} /></label><label className="block">New password {firstLogin ? '' : '(optional)'}<input type="password" required={firstLogin} minLength={12} maxLength={72} autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className={inputClass} /><span className="text-xs text-slate-400">12–72 characters</span></label><label className="block">Confirm new password<input type="password" required={Boolean(newPassword)} autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className={inputClass} /></label><label className="block">Your email<input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass} /></label><button disabled={busy} className="w-full rounded-xl bg-orange-500 p-3 font-bold disabled:opacity-40">{busy ? 'Saving…' : firstLogin ? 'Complete setup' : 'Save account settings'}</button></form>}</main>;
}
