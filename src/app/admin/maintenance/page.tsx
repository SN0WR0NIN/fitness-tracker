import Link from 'next/link';
import { redirect } from 'next/navigation';
import Navbar from '@/components/Navbar';
import MaintenanceControls from '@/components/MaintenanceControls';
import { requireAdmin } from '@/lib/adminGuard';
import { getOperatingState } from '@/lib/operating-mode';

export const dynamic = 'force-dynamic';
export default async function MaintenancePage() {
  const guard = await requireAdmin();
  if (guard.status === 401) redirect('/auth/login');
  if (guard.error) redirect('/dashboard');
  const state = await getOperatingState();
  return <div className="min-h-screen bg-slate-950 text-white"><Navbar /><main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6"><Link href="/admin" className="font-bold text-lime-300">← Command Centre</Link><header><h1 className="text-3xl font-black">Maintenance controls</h1><p className="mt-3 text-slate-400">Choose what can change while the challenge stays available to view.</p></header><MaintenanceControls initial={state} /></main></div>;
}
