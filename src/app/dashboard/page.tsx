import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import AthleteDashboard from '@/components/AthleteDashboard';
import { authOptions } from '@/lib/auth';
import { getParticipantProfile } from '@/lib/participant-profile';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

type DashboardUser = {
  stravaAthleteId: string | null;
};

type DashboardActivity = {
  id: string;
  category: 'RUN' | 'CYCLE' | 'SWIM' | 'WALK_OR_HIKE' | 'TROOP_GAMES';
  distance: number;
  pace: number | null;
  duration: number | null;
  points: number;
  completedWithFriend: boolean;
  companion: string | null;
  companionUserId: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason: string | null;
  occurredAt: Date;
  stravaActivityId: string | null;
};

type SelectableUser = { id: string; name: string };

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) redirect('/auth/login');

  const [profile, userResult, activitiesResult, usersResult] = await Promise.all([
    getParticipantProfile(userId),
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        stravaAthleteId: true,
      },
    }),
    prisma.activity.findMany({
      where: { userId },
      orderBy: { occurredAt: 'desc' },
      select: {
        id: true,
        category: true,
        distance: true,
        pace: true,
        duration: true,
        points: true,
        completedWithFriend: true,
        companion: true,
        companionUserId: true,
        status: true,
        rejectionReason: true,
        occurredAt: true,
        stravaActivityId: true,
      },
    }),
    prisma.user.findMany({
      where: { id: { not: userId } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  const user = userResult as DashboardUser | null;
  const activities = activitiesResult as DashboardActivity[];
  const users = usersResult as SelectableUser[];
  if (!profile || !user) redirect('/auth/login');

  return (
    <AthleteDashboard
      profile={{
        id: profile.id,
        name: profile.name,
        column: profile.column,
        totalPoints: profile.totalPoints,
        rank: profile.rank,
        participantCount: profile.participantCount,
        weeklyScores: profile.weeklyScores.map((week) => ({
          weekNumber: week.weekNumber,
          totalPoints: week.totalPoints,
        })),
        categories: profile.categories,
        achievements: profile.achievements,
        bestWeek: profile.bestWeek ? {
          weekNumber: profile.bestWeek.weekNumber,
          totalPoints: profile.bestWeek.totalPoints,
        } : null,
      }}
      currentUser={{
        stravaConnected: Boolean(user.stravaAthleteId),
      }}
      activities={activities.map((activity) => ({
        ...activity,
        occurredAt: activity.occurredAt.toISOString(),
      }))}
      users={users}
    />
  );
}
