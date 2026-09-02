import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { requireAdmin } from '@/lib/adminGuard';
import { updateActivity } from '@/lib/activities';

const EditActivitySchema = z.object({
  category: z.enum(['RUN', 'CYCLE', 'SWIM', 'WALK_OR_HIKE', 'TROOP_GAMES']).optional(),
  distance: z.number().optional(),
  pace: z.number().optional(),
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

    const activity = await updateActivity(id, data);
    return NextResponse.json(activity);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error('Error editing activity:', error);
    return NextResponse.json({ error: 'Failed to edit activity' }, { status: 500 });
  }
}
