import { editOwnActivityDate } from '@/lib/edit-activity-date';
import { getChallengeSettings } from '@/lib/admin-control';
import { ActivityEditError } from '@/lib/activity-duplicates';
import { deleteOwnActivity, ActivityDeletionError } from '@/lib/delete-activity';
import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { updateActivity } from '@/lib/activities';

const EditSchema = z.object({
  category: z.enum(['RUN', 'CYCLE', 'SWIM', 'WALK_OR_HIKE', 'TROOP_GAMES']).optional(),
  distance: z.number().positive().max(100000).optional(),
  pace: z.number().positive().max(60).nullable().optional(),
  companionUserId: z.string().min(1).nullable().optional(),
  proofUrl: z.string().url().max(2048).nullable().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'No changes supplied');

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { id } = await params;
    const body = await request.json();
    if (body && typeof body === 'object' && 'activityDate' in body) {
      const { activityDate } = z.object({ activityDate: z.string() }).strict().parse(body);
      const settings = await getChallengeSettings();
      return NextResponse.json(await editOwnActivityDate(prisma, id, session.user.id, activityDate, settings.startDate));
    }
    const data = EditSchema.parse(body);
    if (data.category && data.category !== 'TROOP_GAMES' && data.distance === undefined) return NextResponse.json({ error: 'Distance is required.' }, { status: 400 });
    const updated = await updateActivity(id, data, session.user.id);
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? 'Invalid details' }, { status: 400 });
    if (error instanceof ActivityEditError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Error editing pending activity:', error);
    return NextResponse.json({ error: 'Could not save. Refresh and check whether this submission has been reviewed.' }, { status: 409 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { id } = await params;
    await deleteOwnActivity(prisma, id, session.user.id);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    if (error instanceof ActivityDeletionError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2034') {
      return NextResponse.json({ error: 'This activity changed while deleting. Please try again.' }, { status: 409 });
    }
    console.error('Error deleting activity:', error);
    return NextResponse.json({ error: 'Could not delete activity. Please try again.' }, { status: 500 });
  }
}
