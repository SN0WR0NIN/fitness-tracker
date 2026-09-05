import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getChallengeSettings } from '@/lib/admin-control';
import { getSuggestedWeeklyGoal, getWeeklyGoalIntelligence } from '@/lib/engagement';
import { getUserProfileSettings, getWeeklyGoalRecords } from '@/lib/user-profile-settings';
import { getWeekStart } from '@/lib/scoring';

export const dynamic = 'force-dynamic';

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

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const [activitiesResult, weeksResult, profileSettings, goalRecords, challengeSettings] = await Promise.all([
    prisma.activity.findMany({
      where: { userId, status: { in: ['APPROVED', 'REJECTED'] }, reviewedAt: { not: null } },
      select: { id: true, category: true, points: true, status: true, reviewedAt: true, rejectionReason: true },
      orderBy: { reviewedAt: 'desc' },
      take: 8,
    }),
    prisma.weeklyScore.findMany({ where: { userId }, select: { weekNumber: true, weekStart: true, totalPoints: true }, orderBy: { weekStart: 'asc' } }),
    getUserProfileSettings(userId),
    getWeeklyGoalRecords(userId),
    getChallengeSettings(),
  ]);
  const activities = activitiesResult as ReviewedActivity[];
  const weeks = weeksResult as Array<{ weekNumber: number; weekStart: Date; totalPoints: number }>;
  const weeklyGoal = profileSettings?.weeklyGoal ?? getSuggestedWeeklyGoal(weeks, challengeSettings.weeklyGoal);
  const intelligence = getWeeklyGoalIntelligence(weeks, goalRecords, weeklyGoal);
  const weekKey = getWeekStart(new Date()).toISOString().slice(0, 10);
  const goalNotification = intelligence.milestone > 0 ? {
    id: `goal-${weekKey}-${intelligence.milestone}`,
    type: 'success',
    title: intelligence.milestone === 100 ? 'Weekly goal achieved' : intelligence.milestone === 80 ? 'Final push' : 'Halfway to your goal',
    message: intelligence.milestone === 100
      ? `You reached your ${weeklyGoal.toFixed(0)} point target. Keep building the lead!`
      : `${intelligence.remainingPoints.toFixed(1)} points remain with ${intelligence.daysRemaining} days left.`,
    href: '/dashboard',
    createdAt: new Date().toISOString(),
  } : intelligence.status === 'at-risk' && intelligence.daysRemaining <= 2 ? {
    id: `goal-${weekKey}-at-risk`,
    type: 'error',
    title: 'Weekly goal reminder',
    message: `${intelligence.remainingPoints.toFixed(1)} points remain and about ${intelligence.hoursRemaining} hours are left.`,
    href: '/dashboard',
    createdAt: new Date().toISOString(),
  } : null;

  const reviewNotifications = activities.map((activity) => ({
    id: activity.id,
    type: activity.status === 'APPROVED' ? 'success' : 'error',
    title: activity.status === 'APPROVED' ? 'Activity approved' : 'Activity needs attention',
    message: activity.status === 'APPROVED'
      ? `${categoryLabels[activity.category]} earned ${activity.points.toFixed(1)} points.`
      : activity.rejectionReason || `${categoryLabels[activity.category]} was not approved.`,
    href: `/dashboard#activity-${activity.id}`,
    createdAt: activity.reviewedAt?.toISOString() ?? new Date().toISOString(),
  }));
  return NextResponse.json(goalNotification ? [goalNotification, ...reviewNotifications].slice(0, 8) : reviewNotifications);
}
