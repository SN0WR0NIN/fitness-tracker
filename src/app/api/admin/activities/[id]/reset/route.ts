import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';
import { resetActivityToPending } from '@/lib/activities';
import { recordAdminAudit } from '@/lib/admin-control';

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
    const activity = await resetActivityToPending(id);
    await recordAdminAudit(guard.userId, 'Reset activity for review', id);
    return NextResponse.json(activity);
  } catch (error) {
    console.error('Error resetting activity to pending:', error);
    return NextResponse.json({ error: 'Failed to reset activity' }, { status: 500 });
  }
}
