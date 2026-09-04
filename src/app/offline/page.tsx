import Link from 'next/link';
import { CloudOff, RefreshCw } from 'lucide-react';

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-5 text-white">
      <section className="w-full max-w-lg rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center shadow-2xl">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-400/10 text-orange-300"><CloudOff className="h-8 w-8" /></span>
        <h1 className="mt-6 text-3xl font-black">You&apos;re offline</h1>
        <p className="mt-3 leading-7 text-slate-400">Your saved activity draft is safe on this device. Reconnect to load live standings or submit it for review.</p>
        <Link href="/dashboard" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-sm font-black transition hover:bg-orange-400"><RefreshCw className="h-4 w-4" />Try again</Link>
      </section>
    </main>
  );
}
