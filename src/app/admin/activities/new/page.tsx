import Link from 'next/link';
import { redirect } from 'next/navigation';
import AdminCreateActivityForm from '@/components/AdminCreateActivityForm';
import Navbar from '@/components/Navbar';
import { requireAdmin } from '@/lib/adminGuard';
import { getChallengeSettings } from '@/lib/admin-control';
import { singaporeDate } from '@/lib/activity-date';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

type AdminActivityUser = {
  id: string;
  name: string;
  username: string | null;
  columnId: string | null;
  column: { name: string } | null;
};

export default async function AdminCreateActivityPage() {
  const guard = await requireAdmin();
  if (guard.status === 401) redirect('/auth/login');
  if (guard.error) redirect('/dashboard');

  const [settings, usersResult] = await Promise.all([
    getChallengeSettings(),
    prisma.user.findMany({
      where: { role: 'MEMBER', columnId: { not: null } },
      select: { id: true, name: true, username: true, columnId: true, column: { select: { name: true } } },
      orderBy: [{ column: { name: 'asc' } }, { name: 'asc' }],
    }),
  ]);
  const users = usersResult as AdminActivityUser[];

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <Link href="/admin/activities" className="text-sm font-semibold text-orange-300 hover:text-orange-200">← Activity review</Link>
        <AdminCreateActivityForm
          users={users.map((user) => ({
            id: user.id,
            name: user.name,
            username: user.username,
            columnId: user.columnId!,
            columnName: user.column?.name ?? 'Unassigned',
          }))}
          scoringRules={settings.scoringRules}
          challengeStart={settings.startDate.toISOString().slice(0, 10)}
          challengeEnd={settings.endDate.toISOString().slice(0, 10)}
          today={singaporeDate()}
        />
      </main>
    </div>
  );
}
