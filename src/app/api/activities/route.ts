import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createActivity } from '@/lib/activities';
import { z, ZodError } from 'zod';
import type { Prisma } from '@prisma/client';
import { getChallengeSettings } from '@/lib/admin-control';
import { requestLog } from '@/lib/telemetry';

import { parseActivityDate } from '@/lib/activity-date';

// Validation schema for activity submission
const ActivitySchema = z.object({
  activityDate: z.string().refine((value) => !!parseActivityDate(value), "Choose a valid activity date, today or earlier.").optional(),
  category: z.enum(['RUN', 'CYCLE', 'SWIM', 'WALK_OR_HIKE', 'TROOP_GAMES']),
  distance: z.number().positive('Distance must be greater than zero').max(100000, 'Distance is too large').optional(),
  pace: z.number().positive('Pace must be greater than zero').max(60, 'Pace is too large').optional(),
  companionUserId: z.string().optional(),
  proofUrl: z.preprocess((val) => (val === '' ? undefined : val), z.string().url().optional()),
}).superRefine((data, context) => {
  if (data.category !== 'TROOP_GAMES' && data.distance === undefined) {
    context.addIssue({ code: 'custom', path: ['distance'], message: 'Distance is required for this activity' });
  }
});

export async function POST(request: NextRequest) {
  const log = requestLog(request, '/api/activities');
  try {
    const session = await getServerSession(authOptions);
    const sessionUserId = session?.user?.id;
    if (!sessionUserId) {
      log.success({ status: 401 });
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const settings = await getChallengeSettings();
    if (settings.maintenanceMode && session.user.role !== 'ADMIN') {
      log.success({ status: 503, maintenanceMode: true });
      return NextResponse.json({ error: settings.maintenanceMessage }, { status: 503 });
    }

    const body = await request.json();
    const validatedData = ActivitySchema.parse(body);

    if (validatedData.companionUserId === sessionUserId) {
      return NextResponse.json(
        { error: 'You cannot select yourself as your own companion' },
        { status: 400 }
      );
    }

    // userId and columnId are derived from the session, never trusted from the client
    const user = await prisma.user.findUnique({ where: { id: sessionUserId } });
    if (!user || !user.columnId) {
      return NextResponse.json(
        { error: 'User not found or not assigned to a column' },
        { status: 400 }
      );
    }

    if (validatedData.companionUserId) {
      const companion = await prisma.user.findUnique({ where: { id: validatedData.companionUserId } });
      if (!companion) {
        return NextResponse.json({ error: 'Selected companion was not found' }, { status: 400 });
      }
    }

    const activity = await createActivity({
      userId: sessionUserId,
      columnId: user.columnId,
      category: validatedData.category,
      distance: validatedData.distance,
      pace: validatedData.pace,
      companionUserId: validatedData.companionUserId,
      proofUrl: validatedData.proofUrl,
      occurredAt: validatedData.activityDate ? parseActivityDate(validatedData.activityDate)! : undefined,
    });

    log.success({ status: 201, activityId: activity.id });
    return NextResponse.json(activity, { status: 201 });
  } catch (error) {
    log.failure(error);
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || 'Invalid activity details' }, { status: 400 });
    }
    return NextResponse.json(
      { error: 'Failed to create activity' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const columnId = searchParams.get('columnId');
    const weekNumber = searchParams.get('weekNumber');
    const status = searchParams.get('status');
    const limit = searchParams.get('limit');

    const where: Prisma.ActivityWhereInput = {};
    if (userId) where.userId = userId;
    if (columnId) where.columnId = columnId;
    if (weekNumber) where.weekNumber = parseInt(weekNumber);
    if (status === 'PENDING' || status === 'APPROVED' || status === 'REJECTED') {
      where.status = status;
    }

    const activities = await prisma.activity.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: status === 'APPROVED' ? { reviewedAt: 'desc' } : { createdAt: 'desc' },
      ...(limit ? { take: parseInt(limit) } : {}),
    });

    return NextResponse.json(activities);
  } catch (error) {
    console.error('Error fetching activities:', error);
    return NextResponse.json(
      { error: 'Failed to fetch activities' },
      { status: 500 }
    );
  }
}
