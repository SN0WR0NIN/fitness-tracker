import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getValidStravaToken, fetchAndMapStravaActivities, fetchActivityPhoto } from '@/lib/strava';
import { createActivity } from '@/lib/activities';

// Only import activities from this date onward (configurable without a code change)
const SYNC_START_DATE = process.env.STRAVA_SYNC_START_DATE
  ? new Date(process.env.STRAVA_SYNC_START_DATE)
  : new Date('2026-09-01T00:00:00Z');

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

      await createActivity({
        userId,
        columnId,
        category: activity.category,
        distance: activity.distance,
        pace: activity.pace,
        completedWithFriend: activity.completedWithFriend,
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
