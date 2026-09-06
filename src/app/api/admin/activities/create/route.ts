import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { requireAdmin } from '@/lib/adminGuard';
import { getChallengeSettings, recordAdminAudit } from '@/lib/admin-control';
import { createActivity, approveActivity } from '@/lib/activities';
import { DuplicateApprovalError } from '@/lib/activity-duplicates';
import { challengeDateRangeLabel, isWithinChallengeWindow, parseActivityDate } from '@/lib/activity-date';
import { prisma } from '@/lib/prisma';

const AdminActivitySchema = z.object({
  userId: z.string().min(1),
  activityDate: z.string().refine((value) => Boolean(parseActivityDate(value)), 'Choose a valid activity date, today or earlier.'),
  category: z.enum(['RUN', 'CYCLE', 'SWIM', 'WALK_OR_HIKE', 'TROOP_GAMES']),
  distance: z.number().positive('Distance must be greater than zero').max(100000, 'Distance is too large').optional(),
  pace: z.number().positive('Pace must be greater than zero').max(60, 'Pace is too large').optional(),
  companionUserId: z.string().min(1).optional(),
  proofUrl: z.preprocess((value) => value === '' ? undefined : value, z.string().url().optional()),
  approvalMode: z.enum(['PENDING', 'APPROVED']).default('PENDING'),
}).superRefine((data, context) => {
  if (data.category !== 'TROOP_GAMES' && data.distance === undefined) {
    context.addIssue({ code: 'custom', path: ['distance'], message: 'Distance is required for this activity.' });
  }
});

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (guard.error) return NextResponse.json({ error: guard.error }, { status: guard.status });

  try {
    const data = AdminActivitySchema.parse(await request.json());
    const settings = await getChallengeSettings();
    const occurredAt = parseActivityDate(data.activityDate)!;

    if (!isWithinChallengeWindow(occurredAt, settings.startDate, settings.endDate)) {
      return NextResponse.json({ error: `Activities must fall within the challenge period (${challengeDateRangeLabel(settings.startDate, settings.endDate)}).` }, { status: 400 });
    }

    const target = await prisma.user.findFirst({
      where: { id: data.userId, role: 'MEMBER' },
      select: { id: true, name: true, columnId: true },
    });
    if (!target?.columnId) return NextResponse.json({ error: 'Choose a participant who is assigned to a column.' }, { status: 400 });

    if (data.companionUserId === target.id) {
      return NextResponse.json({ error: 'The participant cannot be their own companion.' }, { status: 400 });
    }
    if (data.companionUserId) {
      const companion = await prisma.user.findFirst({ where: { id: data.companionUserId, role: 'MEMBER' }, select: { id: true } });
      if (!companion) return NextResponse.json({ error: 'Selected companion was not found.' }, { status: 400 });
    }

    const created = await createActivity({
      userId: target.id,
      columnId: target.columnId,
      category: data.category,
      distance: data.distance,
      pace: data.pace,
      companionUserId: data.companionUserId,
      proofUrl: data.proofUrl,
      occurredAt,
    });

    await recordAdminAudit(guard.userId, 'ADMIN_ACTIVITY_CREATED', created.id, {
      participantId: target.id,
      participantName: target.name,
      requestedStatus: data.approvalMode,
      points: created.points,
    });

    if (data.approvalMode === 'PENDING') {
      return NextResponse.json({ activity: created, createdAs: 'PENDING' }, { status: 201 });
    }

    try {
      const approved = await approveActivity(created.id, guard.userId);
      await recordAdminAudit(guard.userId, 'ADMIN_ACTIVITY_CREATED_APPROVED', approved.id, {
        participantId: target.id,
        participantName: target.name,
        points: approved.points,
      });
      return NextResponse.json({ activity: approved, createdAs: 'APPROVED' }, { status: 201 });
    } catch (error) {
      if (error instanceof DuplicateApprovalError) {
        return NextResponse.json({
          error: 'Activity was created as Pending because it matches another submission. Review the possible duplicate before approving it.',
          activity: created,
          createdAs: 'PENDING',
          duplicates: error.matches,
        }, { status: 409 });
      }
      console.error('Admin activity created but automatic approval failed:', error);
      return NextResponse.json({
        activity: created,
        createdAs: 'PENDING',
        warning: 'Activity was created successfully but automatic approval failed. It is waiting in the review queue.',
      }, { status: 201 });
    }
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || 'Invalid activity details.' }, { status: 400 });
    }
    console.error('Error creating activity for participant:', error);
    return NextResponse.json({ error: 'Failed to create activity for participant.' }, { status: 500 });
  }
}
