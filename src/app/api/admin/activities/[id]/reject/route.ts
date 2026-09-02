import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';
import { rejectActivity } from '@/lib/activities';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (guard.error) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const reason = typeof body.reason === 'string' ? body.reason : undefined;

    const activity = await rejectActivity(id, guard.userId, reason);
    return NextResponse.json(activity);
  } catch (error) {
    console.error('Error rejecting activity:', error);
    return NextResponse.json({ error: 'Failed to reject activity' }, { status: 500 });
  }
}
