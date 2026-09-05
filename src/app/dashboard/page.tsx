import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { getServerSession } from 'next-auth';
import AthleteDashboard from '@/components/AthleteDashboard';
import { authOptions } from '@/lib/auth';
import { getParticipantProfile } from '@/lib/participant-profile';
import { prisma } from '@/lib/prisma';
import { getCurrentWeekPoints, getSuggestedWeeklyGoal, getWeeklyGoalIntelligence, getWeeklyStreak } from '@/lib/engagement';
import { getActiveColumnIds, getChallengeSettings } from '@/lib/admin-control';
import { captureWeeklyGoal, getUserProfileSettings, getWeeklyGoalRecords } from '@/lib/user-profile-settings';
import { getWeekStart } from '@/lib/scoring';
import { STRAVA_INTEGRATION_ENABLED } from '@/lib/features';

export const dynamic = 'force-dynamic';

type DashboardUser = {
  stravaAthleteId: string | null;
  email: string;
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
  proofUrl: string | null;
  occurredAt: Date;
  stravaActivityId: string | null;
};

type SelectableUser = { id: string; name: string };
type ColumnScore = { columnId: string; _sum: { totalPoints: number | null } };

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) redirect('/auth/login');

  const [profile, userResult, profileSettings, goalRecords, activitiesResult, columnScoresResult, settings, activeColumnIds] = await Promise.all([
    getParticipantProfile(userId, { includeActivities: false }),
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        stravaAthleteId: true,
        email: true,
      },
    }),
    getUserProfileSettings(userId),
    getWeeklyGoalRecords(userId),
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
        proofUrl: true,
        occurredAt: true,
        stravaActivityId: true,
      },
    }),
    prisma.weeklyScore.groupBy({
      by: ['columnId'],
      _sum: { totalPoints: true },
    }),
    getChallengeSettings(),
    getActiveColumnIds(),
  ]);

  const user = userResult as DashboardUser | null;
  const activities = activitiesResult as DashboardActivity[];
  if (!profile || !user) redirect('/auth/login');

  const users = activities.some((activity) => activity.status === 'PENDING')
    ? await prisma.user.findMany({
        where: { id: { not: userId } },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }) as SelectableUser[]
    : [];

  const activeColumns = new Set(activeColumnIds);
  const columnScores = (columnScoresResult as ColumnScore[])
    .filter((column) => activeColumns.has(column.columnId))
    .map((column) => ({ columnId: column.columnId, totalPoints: column._sum.totalPoints ?? 0 }))
    .sort((a, b) => b.totalPoints - a.totalPoints);

  const suggestedWeeklyGoal = getSuggestedWeeklyGoal(profile.weeklyScores, settings.weeklyGoal);
  const weeklyGoal = profileSettings?.weeklyGoal ?? suggestedWeeklyGoal;
  const currentWeekPoints = getCurrentWeekPoints(profile.weeklyScores);
  const goalIntelligence = getWeeklyGoalIntelligence(profile.weeklyScores, goalRecords, weeklyGoal, new Date(), settings.startDate);
  after(async () => {
    try {
      const start = getWeekStart(new Date());
      if (!goalRecords.some(record => record.weekStart.getTime() === start.getTime() && record.target === weeklyGoal)) {
        await captureWeeklyGoal(userId, start, weeklyGoal);
      }
    } catch (error) {
      console.error('Unable to capture weekly goal:', error);
    }
  });
  const columnRankIndex = profile.column ? columnScores.findIndex((column) => column.columnId === profile.column?.id) : -1;
  const gapToNext = columnRankIndex > 0
    ? Math.max(0, columnScores[columnRankIndex - 1].totalPoints - columnScores[columnRankIndex].totalPoints)
    : 0;

  return (
    <AthleteDashboard
      profile={{
        id: profile.id,
        name: profile.name,
        bio: profile.bio,
        profilePhotoUrl: profile.profilePhotoUrl,
        column: profile.column,
        totalPoints: profile.totalPoints,
        rank: profile.rank,
        participantCount: profile.participantCount,
        weeklyScores: profile.weeklyScores.map((week) => ({
          weekNumber: week.weekNumber,
          totalPoints: week.totalPoints,
        })),
        categories: profile.categories,
        achievements: [...profile.achievements, ...goalIntelligence.badges],
        bestWeek: profile.bestWeek ? {
          weekNumber: profile.bestWeek.weekNumber,
          totalPoints: profile.bestWeek.totalPoints,
        } : null,
      }}
      currentUser={{
        stravaEnabled: STRAVA_INTEGRATION_ENABLED,
        stravaConnected: Boolean(user.stravaAthleteId),
        email: user.email,
        hasCustomWeeklyGoal: Boolean(profileSettings),
      }}
      engagement={{
        weeklyGoal,
        currentWeekPoints,
        weeklyStreak: getWeeklyStreak(profile.weeklyScores),
        columnRank: columnRankIndex >= 0 ? columnRankIndex + 1 : null,
        columnCount: columnScores.length,
        gapToNext,
        goalStatus: goalIntelligence.status,
        daysRemaining: goalIntelligence.daysRemaining,
        hoursRemaining: goalIntelligence.hoursRemaining,
        remainingPoints: goalIntelligence.remainingPoints,
        goalCompletionStreak: goalIntelligence.completionStreak,
        milestone: goalIntelligence.milestone,
        goalHistory: goalIntelligence.history,
      }}
      activities={activities.map((activity) => ({
        ...activity,
        occurredAt: activity.occurredAt.toISOString(),
      }))}
      users={users}
    />
  );
}
