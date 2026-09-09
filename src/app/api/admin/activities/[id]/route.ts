import { ActivityEditError } from '@/lib/activity-duplicates';
import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { requireAdmin } from '@/lib/adminGuard';
import { updateActivity } from '@/lib/activities';
import { prisma } from '@/lib/prisma';
import { recordAdminAudit } from '@/lib/admin-control';
import { MAX_ACTIVITY_PROOFS } from '@/lib/proof-access';

const halfPoint = z.number().nonnegative('Total points cannot be negative').max(100000)
  .refine((value) => Math.abs(value * 2 - Math.round(value * 2)) < 1e-9, 'Total points must use 0.5-point increments');
const proof = z.string().url().max(2048);

const EditActivitySchema = z.object({
  category: z.enum(['RUN', 'CYCLE', 'SWIM', 'WALK_OR_HIKE', 'TROOP_GAMES']).optional(),
  distance: z.number().positive('Distance must be greater than zero').max(100000).optional(),
  pace: z.number().positive('Pace must be greater than zero').max(60).nullable().optional(),
  companionUserIds: z.array(z.string().min(1).max(200)).max(100).optional(),
  companionUserId: z.string().nullable().optional(),
  companionName: z.string().nullable().optional(),
  proofUrl: proof.nullable().optional(),
  proofUrls: z.array(proof).max(MAX_ACTIVITY_PROOFS).optional(),
  basePointsOverride: z.number().nonnegative('Base points cannot be negative').max(100000).nullable().optional(),
  totalPointsOverride: halfPoint.nullable().optional(),
}).refine((value) => !value.proofUrls || new Set(value.proofUrls).size === value.proofUrls.length, {
  message: 'The same proof photo cannot be attached twice.', path: ['proofUrls'],
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
    const scoreOverrideChanged = data.basePointsOverride !== undefined || data.totalPointsOverride !== undefined;
    await recordAdminAudit(guard.userId, scoreOverrideChanged ? 'Overrode activity score' : 'Corrected activity', id, data);
    return NextResponse.json(activity);
  } catch (error) {
    if (error instanceof ActivityEditError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || 'Invalid activity details' }, { status: 400 });
    }
    console.error('Error editing activity:', error);
    return NextResponse.json({ error: 'Failed to edit activity' }, { status: 500 });
  }
}
