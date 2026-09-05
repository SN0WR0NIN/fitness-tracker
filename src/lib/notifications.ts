import { prisma } from '@/lib/prisma';
import { getChallengeSettings } from '@/lib/admin-control';
import { getSuggestedWeeklyGoal, getWeeklyGoalIntelligence } from '@/lib/engagement';
import { getWeekStart } from '@/lib/scoring';
import { getUserProfileSettings, getWeeklyGoalRecords } from '@/lib/user-profile-settings';

export type UserNotification = {
  id: string;
  type: 'success' | 'error' | 'info';
  kind: string;
  title: string;
  message: string;
  href: string;
  createdAt: string;
};

const categoryLabels = {
  RUN: 'Run',
  CYCLE: 'Cycle',
  SWIM: 'Swim',
  WALK_OR_HIKE: 'Walk / Hike',
  TROOP_GAMES: 'Troop Games',
} as const;

type ReviewedActivity = {
  id: string;
  category: keyof typeof categoryLabels;
  points: number;
  status: 'APPROVED' | 'REJECTED';
  reviewedAt: Date | null;
  rejectionReason: string | null;
};

type StoredNotification = {
  id: string;
  kind: string;
  level: 'success' | 'error' | 'info';
  title: string;
  message: string;
  href: string;
  createdAt: Date;
};

export async function getUserNotifications(userId: string, limit = 30): Promise<UserNotification[]> {
  const [storedRows, activitiesResult, weeksResult, profileSettings, goalRecords, challengeSettings] = await Promise.all([
    prisma.$queryRawUnsafe(`
      SELECT id::text, kind, level, title, message, href, created_at AS "createdAt"
      FROM app_internal.notification
      WHERE user_id=$1
      ORDER BY created_at DESC
      LIMIT $2
    `, userId, limit) as Promise<StoredNotification[]>,
    prisma.activity.findMany({
      where: { userId, status: { in: ['APPROVED', 'REJECTED'] }, reviewedAt: { not: null } },
      select: { id: true, category: true, points: true, status: true, reviewedAt: true, rejectionReason: true },
      orderBy: { reviewedAt: 'desc' },
      take: 12,
    }),
    prisma.weeklyScore.findMany({
      where: { userId },
      select: { weekNumber: true, weekStart: true, totalPoints: true },
      orderBy: { weekStart: 'asc' },
    }),
    getUserProfileSettings(userId),
    getWeeklyGoalRecords(userId),
    getChallengeSettings(),
  ]);

  const activities = activitiesResult as ReviewedActivity[];
  const weeks = weeksResult as Array<{ weekNumber: number; weekStart: Date; totalPoints: number }>;
  const weeklyGoal = profileSettings?.weeklyGoal ?? getSuggestedWeeklyGoal(weeks, challengeSettings.weeklyGoal);
  const intelligence = getWeeklyGoalIntelligence(weeks, goalRecords, weeklyGoal);
  const weekKey = getWeekStart(new Date()).toISOString().slice(0, 10);

  const goalNotification: UserNotification | null = intelligence.milestone > 0 ? {
    id: `goal-${weekKey}-${intelligence.milestone}`,
    type: 'success',
    kind: 'WEEKLY_GOAL',
    title: intelligence.milestone === 100 ? 'Weekly goal achieved' : intelligence.milestone === 80 ? 'Final push' : 'Halfway to your goal',
    message: intelligence.milestone === 100
      ? `You reached your ${weeklyGoal.toFixed(0)} point target. Keep building the lead!`
      : `${intelligence.remainingPoints.toFixed(1)} points remain with ${intelligence.daysRemaining} days left.`,
    href: '/dashboard',
    createdAt: new Date().toISOString(),
  } : intelligence.status === 'at-risk' && intelligence.daysRemaining <= 2 ? {
    id: `goal-${weekKey}-at-risk`,
    type: 'error',
    kind: 'WEEKLY_GOAL',
    title: 'Weekly goal reminder',
    message: `${intelligence.remainingPoints.toFixed(1)} points remain and about ${intelligence.hoursRemaining} hours are left.`,
    href: '/dashboard',
    createdAt: new Date().toISOString(),
  } : null;

  const reviewNotifications: UserNotification[] = activities.map((activity) => ({
    id: `review-${activity.id}`,
    type: activity.status === 'APPROVED' ? 'success' : 'error',
    kind: 'ACTIVITY_REVIEW',
    title: activity.status === 'APPROVED' ? 'Activity approved' : 'Activity needs attention',
    message: activity.status === 'APPROVED'
      ? `${categoryLabels[activity.category]} earned ${activity.points.toFixed(1)} points.`
      : activity.rejectionReason || `${categoryLabels[activity.category]} was not approved.`,
    href: `/dashboard#activity-${activity.id}`,
    createdAt: activity.reviewedAt?.toISOString() ?? new Date().toISOString(),
  }));

  const storedNotifications: UserNotification[] = storedRows.map((row) => ({
    id: `stored-${row.id}`,
    type: row.level,
    kind: row.kind,
    title: row.title,
    message: row.message,
    href: row.href,
    createdAt: row.createdAt.toISOString(),
  }));

  const merged = [...storedNotifications, ...reviewNotifications, ...(goalNotification ? [goalNotification] : [])];
  return merged
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
}
