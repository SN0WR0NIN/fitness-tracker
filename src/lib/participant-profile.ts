import { prisma } from '@/lib/prisma';
import type { ActivityCategory } from '@prisma/client';

const CATEGORY_DETAILS = {
  RUN: { label: 'Run', colour: 'bg-orange-400' },
  CYCLE: { label: 'Cycle', colour: 'bg-sky-400' },
  SWIM: { label: 'Swim', colour: 'bg-cyan-300' },
  WALK_OR_HIKE: { label: 'Walk / Hike', colour: 'bg-emerald-400' },
  TROOP_GAMES: { label: 'Troop Games', colour: 'bg-violet-400' },
} as const;

export type ProfileAchievement = {
  name: string;
  description: string;
  unlocked: boolean;
  progress: number;
};

type ProfileActivity = {
  id: string;
  category: ActivityCategory;
  distance: number;
  pace: number | null;
  duration: number | null;
  elevationGain: number | null;
  points: number;
  completedWithFriend: boolean;
  companion: string | null;
  proofUrl: string | null;
  stravaActivityId: string | null;
  occurredAt: Date;
  weekNumber: number;
};

type ProfileWeekScore = {
  weekNumber: number;
  weekStart: Date;
  totalPoints: number;
  runPoints: number;
  cyclePoints: number;
  swimPoints: number;
  hikePoints: number;
  troopGamePoints: number;
};

type ProfileUser = {
  id: string;
  name: string;
  createdAt: Date;
  column: { id: string; name: string } | null;
  activities: ProfileActivity[];
  weeklyScores: ProfileWeekScore[];
};

type RankedScore = {
  userId: string;
  _sum: { totalPoints: number | null };
};

export async function getParticipantProfile(userId: string) {
  const [userResult, rankedScoresResult] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        createdAt: true,
        column: { select: { id: true, name: true } },
        activities: {
          where: { status: 'APPROVED' },
          orderBy: { occurredAt: 'desc' },
          select: {
            id: true,
            category: true,
            distance: true,
            pace: true,
            duration: true,
            elevationGain: true,
            points: true,
            completedWithFriend: true,
            companion: true,
            proofUrl: true,
            stravaActivityId: true,
            occurredAt: true,
            weekNumber: true,
          },
        },
        weeklyScores: {
          orderBy: { weekStart: 'asc' },
          select: {
            weekNumber: true,
            weekStart: true,
            totalPoints: true,
            runPoints: true,
            cyclePoints: true,
            swimPoints: true,
            hikePoints: true,
            troopGamePoints: true,
          },
        },
      },
    }),
    prisma.weeklyScore.groupBy({
      by: ['userId'],
      _sum: { totalPoints: true },
      orderBy: { _sum: { totalPoints: 'desc' } },
    }),
  ]);

  const user = userResult as ProfileUser | null;
  const rankedScores = rankedScoresResult as RankedScore[];

  if (!user) return null;

  const totalPoints = user.weeklyScores.reduce((sum, week) => sum + week.totalPoints, 0);
  const rankIndex = rankedScores.findIndex((entry) => entry.userId === user.id);
  const categories = (Object.keys(CATEGORY_DETAILS) as ActivityCategory[]).map((key) => {
    const details = CATEGORY_DETAILS[key];
    const points = user.activities
      .filter((activity) => activity.category === key)
      .reduce((sum, activity) => sum + activity.points, 0);
    return { key, ...details, points };
  });
  const activeCategories = categories.filter((category) => category.points > 0).length;
  const friendActivities = user.activities.filter((activity) => activity.completedWithFriend).length;
  const bestWeek = user.weeklyScores.reduce<ProfileWeekScore | null>(
    (best, week) => (!best || week.totalPoints > best.totalPoints ? week : best),
    null
  );

  const achievements: ProfileAchievement[] = [
    {
      name: 'First Move',
      description: 'Complete your first approved activity',
      unlocked: user.activities.length >= 1,
      progress: Math.min(user.activities.length, 1),
    },
    {
      name: 'Momentum',
      description: 'Complete 5 approved activities',
      unlocked: user.activities.length >= 5,
      progress: Math.min(user.activities.length / 5, 1),
    },
    {
      name: 'Team Player',
      description: 'Complete 3 activities with a friend',
      unlocked: friendActivities >= 3,
      progress: Math.min(friendActivities / 3, 1),
    },
    {
      name: 'All-Rounder',
      description: 'Score in 3 activity categories',
      unlocked: activeCategories >= 3,
      progress: Math.min(activeCategories / 3, 1),
    },
    {
      name: 'Consistency',
      description: 'Record activity across 3 different weeks',
      unlocked: user.weeklyScores.length >= 3,
      progress: Math.min(user.weeklyScores.length / 3, 1),
    },
    {
      name: 'Century Club',
      description: 'Earn 100 total points',
      unlocked: totalPoints >= 100,
      progress: Math.min(totalPoints / 100, 1),
    },
  ];

  return {
    ...user,
    totalPoints,
    rank: rankIndex >= 0 ? rankIndex + 1 : null,
    participantCount: rankedScores.length,
    categories,
    friendActivities,
    activeCategories,
    bestWeek,
    achievements,
  };
}
