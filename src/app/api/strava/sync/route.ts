import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getValidStravaToken, fetchAndMapStravaActivities, fetchActivityPhoto } from '@/lib/strava';
import { createActivity } from '@/lib/activities';
import { STRAVA_INTEGRATION_ENABLED } from '@/lib/features';
import { getChallengeSettings } from '@/lib/admin-control';
import { challengeWindow } from '@/lib/activity-date';

// Optional deployment-level floor for Strava imports. Challenge settings are
// always enforced as the authoritative start/end window below.
const SYNC_START_DATE = process.env.STRAVA_SYNC_START_DATE
  ? new Date(process.env.STRAVA_SYNC_START_DATE)
  : new Date('2026-08-31T16:00:00Z');

export async function POST() {
  try {
    if (!STRAVA_INTEGRATION_ENABLED) {
      return NextResponse.json({ error: 'Strava integration is temporarily unavailable' }, { status: 503 });
    }

    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const [user, settings] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      getChallengeSettings(),
    ]);
    if (!user?.columnId) {
      return NextResponse.json(
        { error: 'User not assigned to a column' },
        { status: 400 }
      );
    }
    const columnId = user.columnId;
    const window = challengeWindow(settings.startDate, settings.endDate);
    const effectiveStart = SYNC_START_DATE > window.start ? SYNC_START_DATE : window.start;

    const tokens = await getValidStravaToken(userId);
    if (!tokens) {
      return NextResponse.json(
        { error: 'Strava is not connected for this account' },
        { status: 400 }
      );
    }

    const stravaActivities = await fetchAndMapStravaActivities(tokens.accessToken, {
      after: effectiveStart,
    });

    let imported = 0;
    let skipped = 0;
    let skippedOutsideChallenge = 0;

    for (const activity of stravaActivities) {
      if (activity.occurredAt < window.start || activity.occurredAt > window.end) {
        skippedOutsideChallenge++;
        continue;
      }

      const existing = await prisma.activity.findUnique({
        where: { stravaActivityId: activity.stravaActivityId },
      });
      if (existing) {
        skipped++;
        continue;
      }

      const photoUrl = await fetchActivityPhoto(tokens.accessToken, activity.stravaActivityId);

      // Strava tells us athlete_count > 1 but not WHO the companion was, so we
      // can't verify they're a real registered troop member — no friend bonus
      // for synced activities; the friend bonus only applies to activities
      // where a companion was explicitly selected from real accounts.
      await createActivity({
        userId,
        columnId,
        category: activity.category,
        distance: activity.distance,
        pace: activity.pace,
        proofUrl: photoUrl ?? undefined,
        stravaActivityId: activity.stravaActivityId,
        occurredAt: activity.occurredAt,
        mapPolyline: activity.mapPolyline,
        elevationGain: activity.elevationGain,
        duration: activity.durationMinutes,
      });
      imported++;
    }

    return NextResponse.json({ imported, skipped, skippedOutsideChallenge });
  } catch (error) {
    console.error('Error syncing Strava activities:', error);
    return NextResponse.json(
      { error: 'Failed to sync Strava activities' },
      { status: 500 }
    );
  }
}
