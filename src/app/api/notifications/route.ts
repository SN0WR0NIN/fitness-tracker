import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const categoryLabels = {
  RUN: 'Run',
  CYCLE: 'Cycle',
  SWIM: 'Swim',
  WALK_OR_HIKE: 'Walk / Hike',
  TROOP_GAMES: 'Troop Games',
} as const;

type ReviewedActivity = {
  id: string;
  category: keyof typeof categoryLabels;
  points: number;
  status: 'APPROVED' | 'REJECTED';
  reviewedAt: Date | null;
  rejectionReason: string | null;
};

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const activities = await prisma.activity.findMany({
    where: {
      userId,
      status: { in: ['APPROVED', 'REJECTED'] },
      reviewedAt: { not: null },
    },
    select: {
      id: true,
      category: true,
      points: true,
      status: true,
      reviewedAt: true,
      rejectionReason: true,
    },
    orderBy: { reviewedAt: 'desc' },
    take: 8,
  }) as ReviewedActivity[];

  return NextResponse.json(activities.map((activity) => ({
    id: activity.id,
    type: activity.status === 'APPROVED' ? 'success' : 'error',
    title: activity.status === 'APPROVED' ? 'Activity approved' : 'Activity needs attention',
    message: activity.status === 'APPROVED'
      ? `${categoryLabels[activity.category]} earned ${activity.points.toFixed(1)} points.`
      : activity.rejectionReason || `${categoryLabels[activity.category]} was not approved.`,
    href: `/dashboard#activity-${activity.id}`,
    createdAt: activity.reviewedAt?.toISOString() ?? new Date().toISOString(),
  })));
}
