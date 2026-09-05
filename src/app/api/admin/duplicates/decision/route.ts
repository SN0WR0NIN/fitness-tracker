import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { requireAdmin } from '@/lib/adminGuard';
import {
  DuplicateReviewError,
  markActivityAsDuplicate,
  refreshDuplicateReviewHealth,
  saveDuplicateReviewDecision,
} from '@/lib/duplicate-review';

const DecisionSchema = z.object({
  action: z.enum(['DIFFERENT', 'LATER', 'DUPLICATE']),
  activityAId: z.string().min(1),
  activityBId: z.string().min(1),
  duplicateActivityId: z.string().min(1).optional(),
  note: z.string().trim().max(500).optional(),
}).strict();

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (guard.error) return NextResponse.json({ error: guard.error }, { status: guard.status });

  try {
    const input = DecisionSchema.parse(await request.json());
    const result = input.action === 'DUPLICATE'
      ? await markActivityAsDuplicate({
          activityAId: input.activityAId,
          activityBId: input.activityBId,
          duplicateActivityId: input.duplicateActivityId ?? '',
          reviewerId: guard.userId,
          note: input.note,
        })
      : await saveDuplicateReviewDecision({
          activityAId: input.activityAId,
          activityBId: input.activityBId,
          status: input.action,
          reviewerId: guard.userId,
          note: input.note,
        });

    try {
      await refreshDuplicateReviewHealth();
    } catch (error) {
      console.warn('Duplicate decision saved but scheduled health refresh failed.', error);
    }

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? 'Invalid duplicate-review decision.' }, { status: 400 });
    }
    if (error instanceof DuplicateReviewError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Duplicate review decision failed:', error);
    return NextResponse.json({ error: 'Could not save duplicate-review decision.' }, { status: 500 });
  }
}
