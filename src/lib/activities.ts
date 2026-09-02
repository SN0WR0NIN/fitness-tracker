import { prisma } from '@/lib/prisma';
import { calculateActivityPoints, getWeekStart, getWeekNumber, ActivityCategory } from '@/lib/scoring';

function getCategoryScoreField(category: string): string {
  const mapping: Record<string, string> = {
    RUN: 'runPoints',
    CYCLE: 'cyclePoints',
    SWIM: 'swimPoints',
    WALK_OR_HIKE: 'hikePoints',
    TROOP_GAMES: 'troopGamePoints',
  };
  return mapping[category] || 'totalPoints';
}

interface CreateActivityInput {
  userId: string;
  columnId: string;
  category: ActivityCategory;
  distance?: number;
  pace?: number;
  completedWithFriend?: boolean;
  companion?: string;
  proofUrl?: string;
  stravaActivityId?: string;
  occurredAt?: Date;
}

/**
 * Creates an activity in PENDING status. Points are computed and stored on the
 * record, but never applied to the weekly score until a reviewer approves it.
 */
export async function createActivity(input: CreateActivityInput) {
  const scoring = calculateActivityPoints({
    category: input.category,
    distance: input.distance,
    pace: input.pace,
    completedWithFriend: input.completedWithFriend,
  });

  const occurredAt = input.occurredAt ?? new Date();
  const weekStart = getWeekStart(occurredAt);
  const weekNumber = getWeekNumber(occurredAt);

  return prisma.activity.create({
    data: {
      userId: input.userId,
      columnId: input.columnId,
      category: input.category,
      distance: input.distance,
      pace: input.pace,
      completedWithFriend: input.completedWithFriend ?? false,
      companion: input.companion,
      proofUrl: input.proofUrl,
      stravaActivityId: input.stravaActivityId,
      points: scoring.totalPoints,
      status: 'PENDING',
      weekStart,
      weekNumber,
    },
  });
}

/**
 * Approves a pending (or previously rejected) activity and applies its points
 * to the weekly score. Idempotent if already approved.
 */
export async function approveActivity(activityId: string, reviewerId: string) {
  return prisma.$transaction(async (tx: any) => {
    const activity = await tx.activity.findUnique({ where: { id: activityId } });
    if (!activity) {
      throw new Error('Activity not found');
    }
    if (activity.status === 'APPROVED') {
      return activity;
    }

    await tx.weeklyScore.upsert({
      where: {
        userId_weekStart: {
          userId: activity.userId,
          weekStart: activity.weekStart,
        },
      },
      update: {
        totalPoints: { increment: activity.points },
        [getCategoryScoreField(activity.category)]: { increment: activity.points },
      },
      create: {
        userId: activity.userId,
        columnId: activity.columnId,
        weekStart: activity.weekStart,
        weekNumber: activity.weekNumber,
        totalPoints: activity.points,
        [getCategoryScoreField(activity.category)]: activity.points,
      },
    });

    return tx.activity.update({
      where: { id: activityId },
      data: {
        status: 'APPROVED',
        reviewedById: reviewerId,
        reviewedAt: new Date(),
        rejectionReason: null,
      },
    });
  });
}

/**
 * Rejects an activity. If it was previously approved, its points are first
 * reversed out of the weekly score. Idempotent if already rejected.
 */
export async function rejectActivity(activityId: string, reviewerId: string, reason?: string) {
  return prisma.$transaction(async (tx: any) => {
    const activity = await tx.activity.findUnique({ where: { id: activityId } });
    if (!activity) {
      throw new Error('Activity not found');
    }
    if (activity.status === 'REJECTED') {
      return activity;
    }

    if (activity.status === 'APPROVED') {
      await tx.weeklyScore.update({
        where: {
          userId_weekStart: {
            userId: activity.userId,
            weekStart: activity.weekStart,
          },
        },
        data: {
          totalPoints: { decrement: activity.points },
          [getCategoryScoreField(activity.category)]: { decrement: activity.points },
        },
      });
    }

    return tx.activity.update({
      where: { id: activityId },
      data: {
        status: 'REJECTED',
        reviewedById: reviewerId,
        reviewedAt: new Date(),
        rejectionReason: reason,
      },
    });
  });
}

