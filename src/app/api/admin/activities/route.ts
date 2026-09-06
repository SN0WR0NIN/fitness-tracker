import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/adminGuard';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };

export async function GET(request: NextRequest) {
  const guard = await requireAdmin();
  if (guard.error) {
    return NextResponse.json({ error: guard.error }, { status: guard.status, headers });
  }

  const status = request.nextUrl.searchParams.get('status') || 'PENDING';
  if (!['ALL', 'PENDING', 'APPROVED', 'REJECTED'].includes(status)) {
    return NextResponse.json({ error: 'Choose a valid activity status.' }, { status: 400, headers });
  }

  try {
    const activities = await prisma.activity.findMany({
      where: status === 'ALL' ? {} : { status: status as 'PENDING' | 'APPROVED' | 'REJECTED' },
      include: {
        user: { select: { id: true, name: true, email: true } },
        column: { select: { id: true, name: true } },
        reviewedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json(activities, { headers });
  } catch (error) {
    console.error('Error fetching activities for review:', error);
    return NextResponse.json({ error: 'Failed to fetch activities' }, { status: 500, headers });
  }
}
