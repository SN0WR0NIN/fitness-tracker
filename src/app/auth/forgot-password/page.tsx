'use client';

import { useState } from 'react';
import Link from 'next/link';
import { KeyRound, Mail } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState('');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/account/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier }),
      });
      const data = await response.json();
      setSent(true);
      setMessage(data.message || 'If that account exists, a password reset link has been sent.');
    } catch {
      setMessage('Unable to send the reset email right now. Try again shortly.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-950">
      <section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-md dark:bg-gray-900">
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-500"><KeyRound className="h-6 w-6" /></div>
        <h1 className="text-2xl font-black text-gray-900 dark:text-white">Forgot password?</h1>
        <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-400">Enter your username or login email. We will send a secure reset link to the email address linked to your KG Stay Active account.</p>
        {message ? <div role="status" className={`mt-5 rounded-xl border p-4 text-sm ${sent ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-700 dark:text-emerald-200' : 'border-amber-400/20 bg-amber-400/10 text-amber-700 dark:text-amber-200'}`}>{message}</div> : null}
        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Username or email
            <input required autoComplete="username" value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder="Your username or email" disabled={sent} className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
          </label>
          <button disabled={busy || sent} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-bold text-white transition hover:bg-blue-700 disabled:opacity-50"><Mail className="h-4 w-4" />{busy ? 'Sending…' : sent ? 'Email sent' : 'Send reset link'}</button>
        </form>
        {sent ? <p className="mt-4 text-xs leading-5 text-gray-500">For security, this page does not confirm whether the username or email is registered. Check the account email inbox and spam folder.</p> : null}
        <div className="mt-6 text-center text-sm"><Link href="/auth/login" className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">← Back to login</Link></div>
      </section>
    </main>
  );
}
