import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/adminGuard';
import { prisma } from '@/lib/prisma';
import { recapWeek, buildWeeklyRecap } from '@/lib/weekly-recap';
import WeeklyRecap from '@/components/WeeklyRecap';
export const dynamic = 'force-dynamic';
export default async function RecapPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const guard = await requireAdmin();
  if (guard.status === 401) redirect('/auth/login');
  if (guard.error) redirect('/dashboard');
  const { date } = await searchParams;
  const parsed = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T12:00:00+08:00`) : new Date();
  const chosen = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  const { start, end, previousStart } = recapWeek(chosen);
  const rows = await prisma.activity.findMany({ where: { status: 'APPROVED', occurredAt: { gte: previousStart, lt: end } }, select: { status: true, occurredAt: true, points: true, user: { select: { id: true, name: true } }, column: { select: { id: true, name: true } } } });
  const dateValue = new Date(chosen.getTime() + 8*3600000).toISOString().slice(0,10);
  return <main className="mx-auto min-h-screen max-w-3xl space-y-6 px-4 pt-8 pb-32 text-white"><Link href="/admin" className="text-orange-300">← Admin centre</Link><h1 className="text-3xl font-bold">Weekly competition recap</h1><p className="text-slate-300">Choose any day in the week. Weeks run Sunday to Saturday in Singapore time. Review the message, then copy it to your group.</p><form className="flex flex-wrap items-end gap-3"><label>Day in week<input aria-label="Day in recap week" type="date" name="date" defaultValue={dateValue} required className="mt-2 block rounded-xl border border-white/20 bg-slate-900 p-3" /></label><button className="min-h-11 rounded-xl border border-orange-300/40 px-4 py-3">Generate recap</button><Link className="min-h-11 rounded-xl border border-white/20 px-4 py-3" href={`/admin/recap?date=${new Date(previousStart.getTime()+8*3600000).toISOString().slice(0,10)}`}>Previous week</Link></form><WeeklyRecap key={dateValue} text={buildWeeklyRecap(rows, start, end)} /></main>;
}
