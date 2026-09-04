import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { requireAdmin } from '@/lib/adminGuard';
import { updateActivity } from '@/lib/activities';
import { prisma } from '@/lib/prisma';
import { recordAdminAudit } from '@/lib/admin-control';

const EditActivitySchema = z.object({
  category: z.enum(['RUN', 'CYCLE', 'SWIM', 'WALK_OR_HIKE', 'TROOP_GAMES']).optional(),
  distance: z.number().positive('Distance must be greater than zero').max(100000).optional(),
  pace: z.number().positive('Pace must be greater than zero').max(60).optional(),
  companionUserId: z.string().nullable().optional(),
  companionName: z.string().nullable().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (guard.error) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const data = EditActivitySchema.parse(body);

    if (data.companionUserId) {
      const activity = await prisma.activity.findUnique({ where: { id }, select: { userId: true } });
      if (!activity) {
        return NextResponse.json({ error: 'Activity not found' }, { status: 404 });
      }
      if (data.companionUserId === activity.userId) {
        return NextResponse.json(
          { error: "The activity owner can't be their own companion" },
          { status: 400 }
        );
      }
      const companion = await prisma.user.findUnique({ where: { id: data.companionUserId } });
      if (!companion) {
        return NextResponse.json({ error: 'Selected companion was not found' }, { status: 400 });
      }
    }

    const activity = await updateActivity(id, data);
    await recordAdminAudit(guard.userId, 'Corrected activity', id, data);
    return NextResponse.json(activity);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || 'Invalid activity details' }, { status: 400 });
    }
    console.error('Error editing activity:', error);
    return NextResponse.json({ error: 'Failed to edit activity' }, { status: 500 });
  }
}
