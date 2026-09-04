import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import AdminActivityReview from '@/components/AdminActivityReview';
import Navbar from '@/components/Navbar';
import { requireAdmin } from '@/lib/adminGuard';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

type ReviewActivity = {
  id: string;
  category: 'RUN' | 'CYCLE' | 'SWIM' | 'WALK_OR_HIKE' | 'TROOP_GAMES';
  distance: number;
  pace: number | null;
  duration: number | null;
  elevationGain: number | null;
  points: number;
  completedWithFriend: boolean;
  companion: string | null;
  companionUserId: string | null;
  proofUrl: string | null;
  stravaActivityId: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  occurredAt: Date;
  createdAt: Date;
  reviewedAt: Date | null;
  rejectionReason: string | null;
  user: { id: string; name: string; email: string };
  column: { id: string; name: string };
  reviewedBy: { id: string; name: string } | null;
};

type SelectableUser = { id: string; name: string };

export default async function AdminActivitiesPage() {
  const guard = await requireAdmin();
  if (guard.status === 401) redirect('/auth/login');

  if (guard.error) {
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        <Navbar />
        <main className="mx-auto flex max-w-xl flex-col items-center px-4 py-28 text-center">
          <span className="rounded-3xl bg-white/5 p-5 text-slate-600"><ShieldCheck className="h-12 w-12" /></span>
          <h1 className="mt-6 text-3xl font-black">Admins only</h1>
          <p className="mt-3 text-slate-400">You do not have permission to review activities.</p>
          <Link href="/dashboard" className="mt-7 rounded-xl bg-orange-500 px-5 py-3 font-bold transition hover:bg-orange-400">Return to dashboard</Link>
        </main>
      </div>
    );
  }

  const [activitiesResult, usersResult] = await Promise.all([
    prisma.activity.findMany({
      include: {
        user: { select: { id: true, name: true, email: true } },
        column: { select: { id: true, name: true } },
        reviewedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  const activities = activitiesResult as ReviewActivity[];
  const users = usersResult as SelectableUser[];

  return (
    <AdminActivityReview
      initialActivities={activities.map((activity) => ({
        ...activity,
        occurredAt: activity.occurredAt.toISOString(),
        createdAt: activity.createdAt.toISOString(),
        reviewedAt: activity.reviewedAt?.toISOString() ?? null,
      }))}
      users={users}
    />
  );
}
