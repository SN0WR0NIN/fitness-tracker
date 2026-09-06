import type { PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getChallengeSettings } from '@/lib/admin-control';
import { getSuggestedWeeklyGoal, getWeeklyGoalIntelligence } from '@/lib/engagement';
import { getWeekStart } from '@/lib/scoring';
import { getUserProfileSettings, getWeeklyGoalRecords } from '@/lib/user-profile-settings';
import { getNotificationPreferences } from '@/lib/notification-preferences';

// Keep the existing lazy client, but preserve Prisma's result types in this module.
const db: PrismaClient = prisma;

export type UserNotification = {
  id: string;
  type: 'success' | 'error' | 'info';
  kind: string;
  title: string;
  message: string;
  href: string;
  createdAt: string;
};
const categoryLabels = { RUN: 'Run', CYCLE: 'Cycle', SWIM: 'Swim', WALK_OR_HIKE: 'Walk / Hike', TROOP_GAMES: 'Troop Games' } as const;
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
  const preferences = await getNotificationPreferences(userId);
  const [storedRows, activities, weeks, profileSettings, goalRecords, challengeSettings] = await Promise.all([
    db.$queryRaw<StoredNotification[]>`SELECT id::text,kind,level,title,message,href,created_at AS "createdAt" FROM app_internal.notification
      WHERE user_id=${userId} AND CASE kind
        WHEN 'ACTIVITY_REVIEW' THEN ${preferences.activity_reviews}
        WHEN 'CORRECTION' THEN ${preferences.correction_updates}
        WHEN 'ACHIEVEMENT' THEN ${preferences.achievements}
        WHEN 'WEEKLY_RESULT' THEN ${preferences.weekly_results}
        WHEN 'WEEKLY_AWARD' THEN ${preferences.weekly_results}
        WHEN 'WEEKLY_GOAL' THEN ${preferences.goal_reminders}
        ELSE true END
      ORDER BY created_at DESC LIMIT ${limit}`,
    preferences.activity_reviews
      ? db.activity.findMany({ where: { userId, status: { in: ['APPROVED', 'REJECTED'] }, reviewedAt: { not: null } }, select: { id: true, category: true, points: true, status: true, reviewedAt: true, rejectionReason: true }, orderBy: { reviewedAt: 'desc' }, take: 12 })
      : Promise.resolve([]),
    preferences.goal_reminders
      ? db.weeklyScore.findMany({ where: { userId }, select: { weekNumber: true, weekStart: true, totalPoints: true }, orderBy: { weekStart: 'asc' } })
      : Promise.resolve([]),
    preferences.goal_reminders ? getUserProfileSettings(userId) : Promise.resolve(null),
    preferences.goal_reminders ? getWeeklyGoalRecords(userId) : Promise.resolve([]),
    preferences.goal_reminders ? getChallengeSettings() : Promise.resolve(null),
  ]);

  let goalNotification: UserNotification | null = null;
  if (preferences.goal_reminders && challengeSettings) {
    const weeklyGoal = profileSettings?.weeklyGoal ?? getSuggestedWeeklyGoal(weeks, challengeSettings.weeklyGoal);
    const intelligence = getWeeklyGoalIntelligence(weeks, goalRecords, weeklyGoal);
    const weekKey = getWeekStart(new Date()).toISOString().slice(0, 10);
    if (intelligence.milestone > 0) {
      goalNotification = {
        id: `goal-${weekKey}-${intelligence.milestone}`,
        type: 'success',
        kind: 'WEEKLY_GOAL',
        title: intelligence.milestone === 100 ? 'Weekly goal achieved' : intelligence.milestone === 80 ? 'Final push' : 'Halfway to your goal',
        message: intelligence.milestone === 100
          ? `You reached your ${weeklyGoal.toFixed(0)} point target. Keep building the lead!`
          : `${intelligence.remainingPoints.toFixed(1)} points remain with ${intelligence.daysRemaining} days left.`,
        href: '/dashboard',
        createdAt: new Date().toISOString(),
      };
    } else if (intelligence.status === 'at-risk' && intelligence.daysRemaining <= 2) {
      goalNotification = {
        id: `goal-${weekKey}-at-risk`,
        type: 'error',
        kind: 'WEEKLY_GOAL',
        title: 'Weekly goal reminder',
        message: `${intelligence.remainingPoints.toFixed(1)} points remain and about ${intelligence.hoursRemaining} hours are left.`,
        href: '/dashboard',
        createdAt: new Date().toISOString(),
      };
    }
  }

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
  return [...storedNotifications, ...reviewNotifications, ...(goalNotification ? [goalNotification] : [])]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
}
