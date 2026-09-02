import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getValidStravaToken, fetchAndMapStravaActivities } from '@/lib/strava';
import { createActivity } from '@/lib/activities';

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

    const stravaActivities = await fetchAndMapStravaActivities(tokens.accessToken);

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

      await createActivity({
        userId,
        columnId,
        category: activity.category,
        distance: activity.distance,
        pace: activity.pace,
        completedWithFriend: activity.completedWithFriend,
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
