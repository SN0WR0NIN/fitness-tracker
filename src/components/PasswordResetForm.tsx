'use client';

import { useState } from 'react';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { KeyRound } from 'lucide-react';

export default function PasswordResetForm({ token, initiallyValid }: { token: string; initiallyValid: boolean }) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (newPassword !== confirmation) {
      setMessage('The new passwords do not match.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/account/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to reset password.');
      await signOut({ redirect: false });
      setDone(true);
      setNewPassword('');
      setConfirmation('');
      setMessage(data.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to reset password.');
    } finally {
      setBusy(false);
    }
  }

  const inputClass = 'mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white';
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-8 dark:bg-gray-950">
      <section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-md dark:bg-gray-900">
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500"><KeyRound className="h-6 w-6" /></div>
        <h1 className="text-2xl font-black text-gray-900 dark:text-white">Reset password</h1>
        <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-400">Choose a new password for your KG Stay Active account. This secure link can only be used once.</p>

        {!initiallyValid ? (
          <div className="mt-6 space-y-4">
            <div role="alert" className="rounded-xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-700 dark:text-amber-200">This reset link is invalid, expired, or has already been used.</div>
            <Link href="/auth/forgot-password" className="block rounded-xl bg-blue-600 px-5 py-3 text-center font-bold text-white">Request a new reset link</Link>
          </div>
        ) : message && done ? (
          <div className="mt-6 space-y-4">
            <div role="status" className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-700 dark:text-emerald-200">{message}</div>
            <Link href="/auth/login" className="block rounded-xl bg-blue-600 px-5 py-3 text-center font-bold text-white">Log in with new password</Link>
          </div>
        ) : (
          <>
            {message ? <div role="alert" className="mt-5 rounded-xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-700 dark:text-amber-200">{message}</div> : null}
            <form onSubmit={submit} className="mt-6 space-y-4">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">New password<input required type="password" autoComplete="new-password" minLength={12} maxLength={72} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className={inputClass} /><span className="mt-1 block text-xs text-gray-500">12–72 characters</span></label>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Confirm new password<input required type="password" autoComplete="new-password" minLength={12} maxLength={72} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className={inputClass} /></label>
              <button disabled={busy} className="w-full rounded-xl bg-blue-600 px-5 py-3 font-bold text-white transition hover:bg-blue-700 disabled:opacity-50">{busy ? 'Resetting…' : 'Set new password'}</button>
            </form>
          </>
        )}
        <div className="mt-6 text-center text-sm"><Link href="/auth/forgot-password" className="text-blue-600 dark:text-blue-400">Need another reset link?</Link></div>
      </section>
    </main>
  );
}
