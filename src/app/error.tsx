'use client';

import { useEffect } from 'react';
import { RefreshCw, TriangleAlert } from 'lucide-react';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('Application page error:', error); }, [error]);
  return <main className="flex min-h-[70vh] items-center justify-center bg-slate-950 px-5 text-white"><section className="w-full max-w-lg rounded-3xl border border-rose-400/20 bg-white/[0.04] p-8 text-center"><TriangleAlert className="mx-auto h-12 w-12 text-rose-300" /><h1 className="mt-5 text-3xl font-black">This page hit a problem</h1><p className="mt-3 text-slate-400">Your data is safe. Try loading the page again, or return in a moment if the service is recovering.</p><button type="button" onClick={reset} className="mt-7 inline-flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-sm font-black"><RefreshCw className="h-4 w-4" />Try again</button></section></main>;
}
