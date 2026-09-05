import { prisma } from '@/lib/prisma';
import type { ActivityCategory } from '@prisma/client';
import { getUserProfileSettings } from '@/lib/user-profile-settings';

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
  category: 'Milestones' | 'Consistency' | 'Social' | 'Variety' | 'Competition';
  tier: 'bronze' | 'silver' | 'gold';
  progressLabel: string;
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
  weeklyScores: ProfileWeekScore[];
};

type RankedScore = {
  userId: string;
  _sum: { totalPoints: number | null };
};

type CategoryScore = {
  category: ActivityCategory;
  _sum: { points: number | null };
};

export async function getParticipantProfile(userId: string, options: { includeActivities?: boolean } = {}) {
  const includeActivities = options.includeActivities ?? true;
  const activityWhere = { userId, status: 'APPROVED' as const };
  const [userResult, rankedScoresResult, profileSettings, activityCount, friendActivities, categoryScoresResult, activitiesResult] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        createdAt: true,
        column: { select: { id: true, name: true } },
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
    getUserProfileSettings(userId),
    prisma.activity.count({ where: activityWhere }),
    prisma.activity.count({ where: { ...activityWhere, completedWithFriend: true } }),
    prisma.activity.groupBy({
      by: ['category'],
      where: activityWhere,
      _sum: { points: true },
    }),
    includeActivities
      ? prisma.activity.findMany({
          where: activityWhere,
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
        })
      : Promise.resolve([] as ProfileActivity[]),
  ]);

  const user = userResult as ProfileUser | null;
  const rankedScores = rankedScoresResult as RankedScore[];
  const categoryScores = categoryScoresResult as CategoryScore[];
  const activities = activitiesResult as ProfileActivity[];

  if (!user) return null;

  const weeklyScoresByNumber = new Map<number, ProfileWeekScore>();
  for (const week of user.weeklyScores) {
    const existing = weeklyScoresByNumber.get(week.weekNumber);
    if (existing) {
      existing.totalPoints += week.totalPoints;
      existing.runPoints += week.runPoints;
      existing.cyclePoints += week.cyclePoints;
      existing.swimPoints += week.swimPoints;
      existing.hikePoints += week.hikePoints;
      existing.troopGamePoints += week.troopGamePoints;
    } else {
      weeklyScoresByNumber.set(week.weekNumber, { ...week });
    }
  }
  const weeklyScores = Array.from(weeklyScoresByNumber.values()).sort((a, b) => a.weekNumber - b.weekNumber);
  const totalPoints = weeklyScores.reduce((sum, week) => sum + week.totalPoints, 0);
  const rankIndex = rankedScores.findIndex((entry) => entry.userId === user.id);
  const rank = rankIndex >= 0 ? rankIndex + 1 : null;

  const scoreByCategory = new Map(categoryScores.map((row) => [row.category, row._sum.points ?? 0]));
  const categories = (Object.keys(CATEGORY_DETAILS) as ActivityCategory[]).map((key) => ({
    key,
    ...CATEGORY_DETAILS[key],
    points: scoreByCategory.get(key) ?? 0,
  }));
  const activeCategories = categories.filter((category) => category.points > 0).length;
  const bestWeek = weeklyScores.reduce<ProfileWeekScore | null>((best, week) => (!best || week.totalPoints > best.totalPoints ? week : best), null);
  const activeWeeks = weeklyScores.filter((week) => week.totalPoints > 0).length;

  const achievements: ProfileAchievement[] = [
    {
      name: 'First Move',
      description: 'Complete your first approved activity',
      unlocked: activityCount >= 1,
      progress: Math.min(activityCount, 1),
      category: 'Milestones',
      tier: 'bronze',
      progressLabel: `${Math.min(activityCount, 1)} / 1 activity`,
    },
    {
      name: 'Momentum',
      description: 'Complete 5 approved activities',
      unlocked: activityCount >= 5,
      progress: Math.min(activityCount / 5, 1),
      category: 'Milestones',
      tier: 'bronze',
      progressLabel: `${Math.min(activityCount, 5)} / 5 activities`,
    },
    {
      name: 'Dedicated',
      description: 'Complete 10 approved activities',
      unlocked: activityCount >= 10,
      progress: Math.min(activityCount / 10, 1),
      category: 'Milestones',
      tier: 'silver',
      progressLabel: `${Math.min(activityCount, 10)} / 10 activities`,
    },
    {
      name: 'Century Club',
      description: 'Earn 100 total points',
      unlocked: totalPoints >= 100,
      progress: Math.min(totalPoints / 100, 1),
      category: 'Milestones',
      tier: 'silver',
      progressLabel: `${Math.min(totalPoints, 100).toFixed(1)} / 100 pts`,
    },
    {
      name: 'Double Century',
      description: 'Earn 200 total points',
      unlocked: totalPoints >= 200,
      progress: Math.min(totalPoints / 200, 1),
      category: 'Milestones',
      tier: 'gold',
      progressLabel: `${Math.min(totalPoints, 200).toFixed(1)} / 200 pts`,
    },
    {
      name: 'Team Player',
      description: 'Complete 3 activities with a registered teammate',
      unlocked: friendActivities >= 3,
      progress: Math.min(friendActivities / 3, 1),
      category: 'Social',
      tier: 'bronze',
      progressLabel: `${Math.min(friendActivities, 3)} / 3 teammate activities`,
    },
    {
      name: 'Social Athlete',
      description: 'Complete 8 activities with registered teammates',
      unlocked: friendActivities >= 8,
      progress: Math.min(friendActivities / 8, 1),
      category: 'Social',
      tier: 'silver',
      progressLabel: `${Math.min(friendActivities, 8)} / 8 teammate activities`,
    },
    {
      name: 'All-Rounder',
      description: 'Score in 3 different activity categories',
      unlocked: activeCategories >= 3,
      progress: Math.min(activeCategories / 3, 1),
      category: 'Variety',
      tier: 'silver',
      progressLabel: `${Math.min(activeCategories, 3)} / 3 categories`,
    },
    {
      name: 'Full Spectrum',
      description: 'Score in every activity category',
      unlocked: activeCategories >= 5,
      progress: Math.min(activeCategories / 5, 1),
      category: 'Variety',
      tier: 'gold',
      progressLabel: `${Math.min(activeCategories, 5)} / 5 categories`,
    },
    {
      name: 'Consistency',
      description: 'Earn points across 3 different weeks',
      unlocked: activeWeeks >= 3,
      progress: Math.min(activeWeeks / 3, 1),
      category: 'Consistency',
      tier: 'silver',
      progressLabel: `${Math.min(activeWeeks, 3)} / 3 active weeks`,
    },
    {
      name: 'Top 10',
      description: 'Reach the overall top 10',
      unlocked: Boolean(rank && rank <= 10),
      progress: rank ? Math.min(1, 10 / rank) : 0,
      category: 'Competition',
      tier: 'silver',
      progressLabel: rank ? `Current rank #${rank}` : 'Not ranked yet',
    },
    {
      name: 'Podium',
      description: 'Reach the overall top 3',
      unlocked: Boolean(rank && rank <= 3),
      progress: rank ? Math.min(1, 3 / rank) : 0,
      category: 'Competition',
      tier: 'gold',
      progressLabel: rank ? `Current rank #${rank}` : 'Not ranked yet',
    },
    {
      name: 'Number One',
      description: 'Take the #1 overall position',
      unlocked: rank === 1,
      progress: rank ? Math.min(1, 1 / rank) : 0,
      category: 'Competition',
      tier: 'gold',
      progressLabel: rank ? `Current rank #${rank}` : 'Not ranked yet',
    },
  ];

  return {
    ...user,
    activities,
    activityCount,
    weeklyScores,
    totalPoints,
    rank,
    participantCount: rankedScores.length,
    categories,
    friendActivities,
    activeCategories,
    bestWeek,
    achievements,
    bio: profileSettings?.bio ?? '',
    profilePhotoUrl: profileSettings?.profilePhotoUrl ?? null,
  };
}
