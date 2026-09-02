import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getValidStravaToken, fetchAndMapStravaActivities, fetchActivityPhoto } from '@/lib/strava';
import { createActivity } from '@/lib/activities';

// Only import activities from this date onward (configurable without a code change).
// The troop operates in Malaysia (UTC+8), so "September 1st" locally begins at
// 2026-08-31T16:00:00Z — using a naive UTC midnight here would wrongly exclude
// activities logged in the early hours of the local day (e.g. an evening ride
// or a workout done just after midnight local time but still "yesterday" UTC).
const SYNC_START_DATE = process.env.STRAVA_SYNC_START_DATE
  ? new Date(process.env.STRAVA_SYNC_START_DATE)
  : new Date('2026-08-31T16:00:00Z');

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.columnId) {
      return NextResponse.json(
        { error: 'User not assigned to a column' },
        { status: 400 }
      );
    }
    const columnId = user.columnId;

    const tokens = await getValidStravaToken(userId);
    if (!tokens) {
      return NextResponse.json(
        { error: 'Strava is not connected for this account' },
        { status: 400 }
      );
    }

    const stravaActivities = await fetchAndMapStravaActivities(tokens.accessToken, {
      after: SYNC_START_DATE,
    });

    let imported = 0;
    let skipped = 0;

    for (const activity of stravaActivities) {
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
      });
      imported++;
    }

    return NextResponse.json({ imported, skipped });
  } catch (error) {
    console.error('Error syncing Strava activities:', error);
    return NextResponse.json(
      { error: 'Failed to sync Strava activities' },
      { status: 500 }
    );
  }
}
