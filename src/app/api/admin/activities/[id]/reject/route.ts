import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { requireAdmin } from '@/lib/adminGuard';
import { rejectActivity } from '@/lib/activities';

const RejectActivitySchema = z.object({
  reason: z.string().trim().min(3, 'Please provide a clear rejection reason').max(300, 'Rejection reason is too long'),
});

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
    const { reason } = RejectActivitySchema.parse(body);

    const activity = await rejectActivity(id, guard.userId, reason);
    return NextResponse.json(activity);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || 'Invalid rejection reason' }, { status: 400 });
    }
    console.error('Error rejecting activity:', error);
    return NextResponse.json({ error: 'Failed to reject activity' }, { status: 500 });
  }
}
