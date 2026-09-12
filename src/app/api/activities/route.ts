import { ActivityEditError } from '@/lib/activity-duplicates';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createActivity } from '@/lib/activities';
import { z, ZodError } from 'zod';
import type { Prisma } from '@prisma/client';
import { getChallengeSettings } from '@/lib/admin-control';
import { requestLog } from '@/lib/telemetry';
import { challengeDateRangeLabel, isWithinChallengeWindow, parseActivityDate } from '@/lib/activity-date';
import { MAX_ACTIVITY_PROOFS, normalizeProofUrls } from '@/lib/proof-access';

const proofUrl = z.string().url().max(2048);
type ActivityFeedRow = {
  id: string;
  category: string;
  distance: number;
  pace: number | null;
  duration: number | null;
  points: number;
  completedWithFriend: boolean;
  companion: string | null;
  occurredAt: Date;
  stravaActivityId: string | null;
  mapPolyline: string | null;
  elevationGain: number | null;
  proofUrl: string | null;
  proofUrls: string[];
  user: { id: string; name: string };
};
// Validation schema for activity submission
const ActivitySchema = z.object({
  activityDate: z.string().refine((value) => !!parseActivityDate(value), 'Choose a valid activity date, today or earlier.').optional(),
  category: z.enum(['RUN', 'CYCLE', 'SWIM', 'WALK_OR_HIKE', 'TROOP_GAMES']),
  distance: z.number().positive('Distance must be greater than zero').max(100000, 'Distance is too large').optional(),
  pace: z.number().positive('Pace must be greater than zero').max(60, 'Pace is too large').optional(),
  companionUserIds: z.array(z.string().min(1).max(200)).max(100).optional(),
  companionUserId: z.string().optional(),
  proofUrl: z.preprocess((val) => (val === '' ? undefined : val), proofUrl.optional()),
  proofUrls: z.array(proofUrl).max(MAX_ACTIVITY_PROOFS, `Attach up to ${MAX_ACTIVITY_PROOFS} proof photos.`).optional(),
}).superRefine((data, context) => {
  if (data.category !== 'TROOP_GAMES' && data.distance === undefined) {
    context.addIssue({ code: 'custom', path: ['distance'], message: 'Distance is required for this activity' });
  }
  if (data.proofUrls && new Set(data.proofUrls).size !== data.proofUrls.length) {
    context.addIssue({ code: 'custom', path: ['proofUrls'], message: 'The same proof photo cannot be attached twice.' });
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
    const occurredAt = validatedData.activityDate ? parseActivityDate(validatedData.activityDate)! : new Date();
    if (!isWithinChallengeWindow(occurredAt, settings.startDate, settings.endDate)) {
      return NextResponse.json(
        { error: `Activities must fall within the challenge period (${challengeDateRangeLabel(settings.startDate, settings.endDate)}).` },
        { status: 400 }
      );
    }

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
      companionUserIds: validatedData.companionUserIds,
      proofUrl: validatedData.proofUrl,
      proofUrls: validatedData.proofUrls,
      occurredAt,
    });

    log.success({ status: 201, activityId: activity.id });
    return NextResponse.json(activity, { status: 201 });
  } catch (error) {
    log.failure(error);
    if (error instanceof ActivityEditError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || 'Invalid activity details' }, { status: 400 });
    }
    return NextResponse.json(
      { error: 'Failed to create activity' },
      { status: 500 }
    );
  }
}

/**
 * Public activity reads intentionally power the landing-page feed and public
 * participant history. Keep this endpoint approved-only and return only
 * public display fields. Private proof references are included only when the
 * caller explicitly asks for authorized proofs and is the owner or an admin.
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const columnId = searchParams.get('columnId');
    const weekNumber = searchParams.get('weekNumber');
    const requestedStatus = searchParams.get('status');
    const requestedLimit = Number.parseInt(searchParams.get('limit') || '50', 10);
    const includeAuthorizedProofs = searchParams.get('includeProofs') === 'authorized';
    const session = includeAuthorizedProofs ? await getServerSession(authOptions) : null;

    if (requestedStatus && requestedStatus !== 'APPROVED') {
      return NextResponse.json({ error: 'Only approved activities are publicly available.' }, { status: 403 });
    }

    const where: Prisma.ActivityWhereInput = { status: 'APPROVED' };
    if (userId) where.userId = userId;
    if (columnId) where.columnId = columnId;
    if (weekNumber) {
      const parsedWeek = Number.parseInt(weekNumber, 10);
      if (!Number.isFinite(parsedWeek) || parsedWeek < 1) {
        return NextResponse.json({ error: 'Invalid week number' }, { status: 400 });
      }
      where.weekNumber = parsedWeek;
    }

    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 50) : 50;
    const activities = await prisma.activity.findMany({
      where,
      select: {
        id: true,
        category: true,
        distance: true,
        pace: true,
        duration: true,
        points: true,
        completedWithFriend: true,
        companion: true,
        occurredAt: true,
        stravaActivityId: true,
        mapPolyline: true,
        elevationGain: true,
        proofUrl: true,
        proofUrls: true,
        user: { select: { id: true, name: true } },
      },
      orderBy: { reviewedAt: 'desc' },
      take: limit,
    }) as ActivityFeedRow[];

    const visibleActivities = activities.map((activity) => {
      const { proofUrl: legacyProof, proofUrls, ...publicActivity } = activity;
      const maySeeProofs = includeAuthorizedProofs
        && session?.user?.id
        && (session.user.role === 'ADMIN' || session.user.id === activity.user.id);
      return maySeeProofs
        ? { ...publicActivity, proofUrls: normalizeProofUrls(proofUrls, legacyProof) }
        : publicActivity;
    });

    return NextResponse.json(visibleActivities, {
      headers: includeAuthorizedProofs
        ? { 'Cache-Control': 'private, no-store, max-age=0', Vary: 'Cookie' }
        : { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('Error fetching public activities:', error);
    return NextResponse.json(
      { error: 'Failed to fetch activities' },
      { status: 500 }
    );
  }
}
