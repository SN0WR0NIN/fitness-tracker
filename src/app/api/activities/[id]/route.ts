import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { updateActivity } from '@/lib/activities';

const EditCompanionSchema = z.object({
  companionUserId: z.string().nullable(),
});

/**
 * Member self-service: lets the owner of a PENDING, Strava-synced activity
 * set/clear who they completed it with (Strava sync has no way to ask this
 * at import time). Only the companion field is editable here — category,
 * distance, pace etc. are admin-only via /api/admin/activities/[id].
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const sessionUserId = session?.user?.id;
    if (!sessionUserId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { companionUserId } = EditCompanionSchema.parse(body);

    const activity = await prisma.activity.findUnique({ where: { id } });
    if (!activity) {
      return NextResponse.json({ error: 'Activity not found' }, { status: 404 });
    }
    if (activity.userId !== sessionUserId) {
      return NextResponse.json({ error: 'Not your activity' }, { status: 403 });
    }
    if (activity.status !== 'PENDING') {
      return NextResponse.json({ error: 'Only pending activities can be edited' }, { status: 400 });
    }
    if (!activity.stravaActivityId) {
      return NextResponse.json(
        { error: 'Only Strava-synced activities can be edited here' },
        { status: 400 }
      );
    }

    if (companionUserId) {
      if (companionUserId === sessionUserId) {
        return NextResponse.json(
          { error: 'You cannot select yourself as your own companion' },
          { status: 400 }
        );
      }
      const companion = await prisma.user.findUnique({ where: { id: companionUserId } });
      if (!companion) {
        return NextResponse.json({ error: 'Selected companion was not found' }, { status: 400 });
      }
    }

    const updated = await updateActivity(id, { companionUserId });
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error('Error editing activity companion:', error);
    return NextResponse.json({ error: 'Failed to update activity' }, { status: 500 });
  }
}
