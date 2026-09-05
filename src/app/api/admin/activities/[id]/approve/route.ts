import { DuplicateApprovalError } from '@/lib/activity-duplicates';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';
import { approveActivity } from '@/lib/activities';
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
    const body = await request.json().catch(() => ({}));
    const override = typeof body.duplicateOverrideReason === 'string' ? body.duplicateOverrideReason.trim().slice(0, 300) : undefined;
    if (override && override.length < 10) return NextResponse.json({ error: 'Explain why these are separate workouts (at least 10 characters).' }, { status: 400 });
    const activity = await approveActivity(id, guard.userId, override);
    await recordAdminAudit(guard.userId, 'Approved activity', id, { points: activity.points, duplicateOverrideReason: override });
    return NextResponse.json(activity);
  } catch (error) {
    if (error instanceof DuplicateApprovalError) return NextResponse.json({ error: error.message, duplicates: error.matches }, { status: 409 });
    console.error('Error approving activity:', error);
    return NextResponse.json({ error: 'Failed to approve activity' }, { status: 500 });
  }
}
