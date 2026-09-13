'use client';

import { useState } from 'react';
import Link from 'next/link';
import { KeyRound } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/account/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      setMessage(data.message || 'If an account exists for that email, we sent a reset link.');
    } catch {
      setMessage('Unable to submit the request right now. Try again shortly.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-950">
      <section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-md dark:bg-gray-900">
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-500"><KeyRound className="h-6 w-6" /></div>
        <h1 className="text-2xl font-black text-gray-900 dark:text-white">Forgot password?</h1>
        <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-400">Enter your login email and we&apos;ll send you a secure, one-time reset link. For security, the confirmation is the same whether or not the account exists.</p>
        {message ? <div role="status" className="mt-5 rounded-xl border border-blue-400/20 bg-blue-400/10 p-4 text-sm text-blue-700 dark:text-blue-200">{message}</div> : null}
        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Email
            <input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
          </label>
          <button disabled={busy} className="w-full rounded-xl bg-blue-600 px-5 py-3 font-bold text-white transition hover:bg-blue-700 disabled:opacity-50">{busy ? 'Sending link…' : 'Send reset link'}</button>
        </form>
        <div className="mt-6 space-y-3 text-center text-sm">
          <Link href="/auth/login" className="block text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">← Back to login</Link>
        </div>
      </section>
    </main>
  );
}
