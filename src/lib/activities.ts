import { prisma } from '@/lib/prisma';
import { calculateActivityPoints, resolveEffectiveCategory, getWeekStart, getWeekNumber, ActivityCategory } from '@/lib/scoring';

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
  companionUserId?: string;
  proofUrl?: string;
  stravaActivityId?: string;
  occurredAt?: Date;
}

/**
 * Creates an activity in PENDING status. Points are computed and stored on the
 * record, but never applied to the weekly score until a reviewer approves it.
 * Slow "runs" (pace > 9 min/km) are auto-recategorized as Walk/Hike per the
 * official rules, and the friend bonus only applies when a real registered
 * companion user is selected (verifies they're an actual troop member).
 */
export async function createActivity(input: CreateActivityInput) {
  const effectiveCategory = resolveEffectiveCategory(input.category, input.pace);
  const completedWithFriend = !!input.companionUserId;

  let companionName: string | undefined;
  if (input.companionUserId) {
    const companionUser = await prisma.user.findUnique({ where: { id: input.companionUserId } });
    companionName = companionUser?.name;
  }

  const scoring = calculateActivityPoints({
    category: effectiveCategory,
    distance: input.distance,
    pace: input.pace,
    completedWithFriend,
  });

  const occurredAt = input.occurredAt ?? new Date();
  const weekStart = getWeekStart(occurredAt);
  const weekNumber = getWeekNumber(occurredAt);

  return prisma.activity.create({
    data: {
      userId: input.userId,
      columnId: input.columnId,
      category: effectiveCategory,
      distance: input.distance,
      pace: input.pace,
      completedWithFriend,
      companionUserId: input.companionUserId,
      companion: companionName,
      proofUrl: input.proofUrl,
      stravaActivityId: input.stravaActivityId,
      points: scoring.totalPoints,
      status: 'PENDING',
      occurredAt,
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

interface UpdateActivityInput {
  category?: ActivityCategory;
  distance?: number;
  pace?: number;
}

/**
 * Edits an activity's category/distance/pace and recomputes its points.
 * If the activity is currently APPROVED, the weekly score is corrected
 * in the same transaction (reversing the old contribution, applying the new one).
 */
export async function updateActivity(activityId: string, input: UpdateActivityInput) {
  return prisma.$transaction(async (tx: any) => {
    const activity = await tx.activity.findUnique({ where: { id: activityId } });
    if (!activity) {
      throw new Error('Activity not found');
    }

    const requestedCategory = input.category ?? activity.category;
    const newDistance = input.distance ?? activity.distance;
    const newPace = input.pace ?? activity.pace;
    const newCategory = resolveEffectiveCategory(requestedCategory, newPace ?? undefined);

    const scoring = calculateActivityPoints({
      category: newCategory,
      distance: newDistance,
      pace: newPace ?? undefined,
      completedWithFriend: activity.completedWithFriend,
    });

    if (activity.status === 'APPROVED') {
      const oldField = getCategoryScoreField(activity.category);
      const newField = getCategoryScoreField(newCategory);
      const pointsDelta = scoring.totalPoints - activity.points;

      const weeklyScoreData: Record<string, { increment: number } | { decrement: number }> = {
        totalPoints: { increment: pointsDelta },
      };
      if (oldField === newField) {
        weeklyScoreData[oldField] = { increment: pointsDelta };
      } else {
        weeklyScoreData[oldField] = { decrement: activity.points };
        weeklyScoreData[newField] = { increment: scoring.totalPoints };
      }

      await tx.weeklyScore.update({
        where: {
          userId_weekStart: {
            userId: activity.userId,
            weekStart: activity.weekStart,
          },
        },
        data: weeklyScoreData,
      });
    }

    return tx.activity.update({
      where: { id: activityId },
      data: {
        category: newCategory,
        distance: newDistance,
        pace: newPace,
        points: scoring.totalPoints,
      },
    });
  });
}

