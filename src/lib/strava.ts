import axios from 'axios';
import { prisma } from '@/lib/prisma';
import type { ActivityCategory } from '@/lib/scoring';

interface StravaTokenSet {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

/**
 * Returns a valid Strava access token for the user, refreshing it first if expired.
 */
export async function getValidStravaToken(userId: string): Promise<StravaTokenSet | null> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.stravaAccessToken || !user.stravaRefreshToken) {
    return null;
  }

  const isExpired = !user.stravaTokenExpiresAt || user.stravaTokenExpiresAt.getTime() < Date.now() + 60_000;
  if (!isExpired) {
    return {
      accessToken: user.stravaAccessToken,
      refreshToken: user.stravaRefreshToken,
      expiresAt: user.stravaTokenExpiresAt as Date,
    };
  }

  const response = await axios.post('https://www.strava.com/oauth/token', {
    client_id: process.env.STRAVA_CLIENT_ID,
    client_secret: process.env.STRAVA_CLIENT_SECRET,
    grant_type: 'refresh_token',
    refresh_token: user.stravaRefreshToken,
  });

  const { access_token, refresh_token, expires_at } = response.data;
  const expiresAt = new Date(expires_at * 1000);

  await prisma.user.update({
    where: { id: userId },
    data: {
      stravaAccessToken: access_token,
      stravaRefreshToken: refresh_token,
      stravaTokenExpiresAt: expiresAt,
    },
  });

  return { accessToken: access_token, refreshToken: refresh_token, expiresAt };
}

interface StravaSummaryActivity {
  id: number;
  type: string;
  sport_type?: string;
  distance: number; // meters
  moving_time: number; // seconds
  start_date: string;
  athlete_count?: number;
}

const STRAVA_TYPE_TO_CATEGORY: Record<string, ActivityCategory> = {
  Run: 'RUN',
  TrailRun: 'RUN',
  Ride: 'CYCLE',
  VirtualRide: 'CYCLE',
  MountainBikeRide: 'CYCLE',
  Swim: 'SWIM',
  Hike: 'WALK_OR_HIKE',
  Walk: 'WALK_OR_HIKE',
};

export interface MappedStravaActivity {
  stravaActivityId: string;
  category: ActivityCategory;
  distance: number;
  pace?: number;
  completedWithFriend: boolean;
  occurredAt: Date;
}

/**
 * Fetches recent Strava activities and maps the ones we support to our activity schema.
 * Activity types we don't track (e.g. WeightTraining, Yoga) are skipped.
 */
export async function fetchAndMapStravaActivities(
  accessToken: string,
  perPage = 30
): Promise<MappedStravaActivity[]> {
  const response = await axios.get<StravaSummaryActivity[]>(
    'https://www.strava.com/api/v3/athlete/activities',
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { per_page: perPage },
    }
  );

  const mapped: MappedStravaActivity[] = [];

  for (const activity of response.data) {
    const category = STRAVA_TYPE_TO_CATEGORY[activity.sport_type ?? activity.type];
    if (!category) {
      continue;
    }

    const distanceMeters = activity.distance;
    const distance = category === 'SWIM' ? distanceMeters : distanceMeters / 1000;
    const pace =
      category === 'RUN' && distanceMeters > 0
        ? activity.moving_time / 60 / (distanceMeters / 1000)
        : undefined;

    mapped.push({
      stravaActivityId: activity.id.toString(),
      category,
      distance,
      pace,
      completedWithFriend: (activity.athlete_count ?? 1) > 1,
      occurredAt: new Date(activity.start_date),
    });
  }

  return mapped;
}
