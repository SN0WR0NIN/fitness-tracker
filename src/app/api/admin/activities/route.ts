import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/adminGuard';

export async function GET(request: NextRequest) {
  const guard = await requireAdmin();
  if (guard.error) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  try {
    const status = request.nextUrl.searchParams.get('status') || 'PENDING';

    const activities = await prisma.activity.findMany({
      where: { status: status as 'PENDING' | 'APPROVED' | 'REJECTED' },
      include: {
        user: { select: { id: true, name: true, email: true } },
        column: { select: { id: true, name: true } },
        reviewedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json(activities);
  } catch (error) {
    console.error('Error fetching activities for review:', error);
    return NextResponse.json({ error: 'Failed to fetch activities' }, { status: 500 });
  }
}
