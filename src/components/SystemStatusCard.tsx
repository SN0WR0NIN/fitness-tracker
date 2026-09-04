'use client';

import { useEffect, useState } from 'react';
import { Activity, CheckCircle2, RefreshCw, TriangleAlert } from 'lucide-react';

type Health = { status: string; database?: string; maintenanceMode?: boolean; responseTimeMs?: number; checkedAt?: string; release?: string };

export default function SystemStatusCard() {
  const [health, setHealth] = useState<Health | null>(null);
  const [checking, setChecking] = useState(true);

  const check = async () => {
    setChecking(true);
    try {
      const response = await fetch('/api/health', { cache: 'no-store' });
      const data = await response.json();
      setHealth({ ...data, status: response.ok ? data.status : 'unavailable' });
    } catch {
      setHealth({ status: 'unavailable' });
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    const initialCheck = window.setTimeout(() => void check(), 0);
    const interval = window.setInterval(check, 60000);
    return () => { window.clearTimeout(initialCheck); window.clearInterval(interval); };
  }, []);

  const healthy = health?.status === 'healthy';
  return <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:p-6"><div className="flex items-start justify-between gap-4"><div className="flex gap-3"><span className="rounded-xl bg-white/5 p-2.5 text-orange-300"><Activity className="h-5 w-5" /></span><div><h2 className="text-lg font-black">System health</h2><p className="mt-1 text-sm text-slate-500">Live application and database readiness.</p></div></div><button type="button" onClick={check} disabled={checking} aria-label="Refresh system health" className="rounded-lg border border-white/10 p-2 text-slate-400 disabled:opacity-40"><RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} /></button></div><div className={`mt-5 flex items-center gap-3 rounded-xl border p-4 ${healthy ? 'border-emerald-400/20 bg-emerald-400/10' : 'border-rose-400/20 bg-rose-400/10'}`}>{healthy ? <CheckCircle2 className="h-6 w-6 text-emerald-300" /> : <TriangleAlert className="h-6 w-6 text-rose-300" />}<div><p className="font-black">{checking && !health ? 'Checking services…' : healthy ? 'All systems operational' : 'Service check failed'}</p><p className="mt-1 text-xs text-slate-400">{healthy ? `Database connected · ${health.responseTimeMs}ms · release ${health.release}` : 'Open Vercel runtime logs for the latest error details.'}</p></div></div></section>;
}
