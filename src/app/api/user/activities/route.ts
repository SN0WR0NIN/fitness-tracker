import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const PAGE_SIZE = 8;

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const mode = request.nextUrl.searchParams.get('mode');
  if (mode === 'metrics') {
    const activities = await prisma.activity.findMany({
      where: { userId, status: 'APPROVED' },
      orderBy: { occurredAt: 'desc' },
      select: {
        category: true,
        distance: true,
        pace: true,
        points: true,
        status: true,
        occurredAt: true,
        completedWithFriend: true,
      },
    });
    return NextResponse.json({ activities: activities.map((activity) => ({ ...activity, occurredAt: activity.occurredAt.toISOString() })) });
  }

  const offsetParam = Number(request.nextUrl.searchParams.get('offset') ?? '0');
  const offset = Number.isFinite(offsetParam) && offsetParam > 0 ? Math.floor(offsetParam) : 0;
  const [activities, total] = await Promise.all([
    prisma.activity.findMany({
      where: { userId },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      skip: offset,
      take: PAGE_SIZE,
      select: {
        id: true,
        category: true,
        distance: true,
        pace: true,
        duration: true,
        points: true,
        completedWithFriend: true,
        companion: true,
        companionUserId: true,
        status: true,
        rejectionReason: true,
        proofUrl: true,
        occurredAt: true,
        stravaActivityId: true,
      },
    }),
    prisma.activity.count({ where: { userId } }),
  ]);

  return NextResponse.json({
    activities: activities.map((activity) => ({ ...activity, occurredAt: activity.occurredAt.toISOString() })),
    total,
    nextOffset: offset + activities.length,
  });
}
