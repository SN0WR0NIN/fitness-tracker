import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { getServerSession } from 'next-auth';
import AthleteDashboard from '@/components/AthleteDashboard';
import { authOptions } from '@/lib/auth';
import { getParticipantProfile } from '@/lib/participant-profile';
import { prisma } from '@/lib/prisma';
import { getCurrentWeekPoints, getSuggestedWeeklyGoal, getWeeklyGoalIntelligence, getWeeklyStreak } from '@/lib/engagement';
import { getChallengeSettings } from '@/lib/admin-control';
import { captureWeeklyGoal, getWeeklyGoalRecords } from '@/lib/user-profile-settings';
import { getWeekStart } from '@/lib/scoring';
import { STRAVA_INTEGRATION_ENABLED } from '@/lib/features';
import { performanceLog, timed } from '@/lib/telemetry';

export const dynamic = 'force-dynamic';

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
type ColumnScore = { columnId: string; totalPoints: number };

export default async function DashboardPage() {
  const pageStartedAt = Date.now();
  const session = await timed('perf.dashboard.session', () => getServerSession(authOptions), { route: '/dashboard' });
  const userId = session?.user?.id;
  if (!userId) redirect('/auth/login');

  const dataStartedAt = Date.now();
  const [profile, goalRecords, activitiesResult, columnScoresResult, settings] = await Promise.all([
    timed('perf.dashboard.participant_profile', () => getParticipantProfile(userId, { includeActivities: false }), { route: '/dashboard' }),
    timed('perf.dashboard.goal_records', () => getWeeklyGoalRecords(userId), { route: '/dashboard' }),
    timed('perf.dashboard.activities', () => prisma.activity.findMany({
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
    }), { route: '/dashboard' }),
    timed('perf.dashboard.column_scores', () => prisma.$queryRawUnsafe(
      `SELECT
        c."id" AS "columnId",
        COALESCE(SUM(ws."totalPoints"), 0)::float8 AS "totalPoints"
       FROM "Column" c
       LEFT JOIN "WeeklyScore" ws ON ws."columnId" = c."id"
       WHERE c."isActive" = true
       GROUP BY c."id"
       ORDER BY "totalPoints" DESC`,
    ) as Promise<ColumnScore[]>), { route: '/dashboard' }),
    timed('perf.dashboard.challenge_settings', () => getChallengeSettings(), { route: '/dashboard' }),
  ]);
  performanceLog('perf.dashboard.parallel_data', Date.now() - dataStartedAt, { route: '/dashboard' });

  const activities = activitiesResult as DashboardActivity[];
  if (!profile) redirect('/auth/login');

  const users = activities.some((activity) => activity.status === 'PENDING')
    ? await timed('perf.dashboard.participant_options', () => prisma.user.findMany({
        where: { id: { not: userId } },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }), { route: '/dashboard' }) as SelectableUser[]
    : [];

  const columnScores = (columnScoresResult as ColumnScore[])
    .sort((a, b) => b.totalPoints - a.totalPoints);

  const suggestedWeeklyGoal = getSuggestedWeeklyGoal(profile.weeklyScores, settings.weeklyGoal);
  const weeklyGoal = profile.weeklyGoal ?? suggestedWeeklyGoal;
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

  performanceLog('perf.dashboard.server_prep', Date.now() - pageStartedAt, {
    route: '/dashboard',
    activityRows: activities.length,
    participantOptions: users.length,
  });

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
        stravaConnected: Boolean(profile.stravaAthleteId),
        email: profile.email,
        hasCustomWeeklyGoal: profile.hasCustomWeeklyGoal,
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
