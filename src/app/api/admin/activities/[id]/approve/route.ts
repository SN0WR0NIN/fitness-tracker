import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';
import { approveActivity } from '@/lib/activities';

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
    const activity = await approveActivity(id, guard.userId);
    return NextResponse.json(activity);
  } catch (error) {
    console.error('Error approving activity:', error);
    return NextResponse.json({ error: 'Failed to approve activity' }, { status: 500 });
  }
}
