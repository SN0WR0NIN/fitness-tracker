import { getWeekStart, getWeekNumber } from './scoring';
import type { PrismaClient, Activity } from '@prisma/client';
import { parseActivityDate, singaporeDate } from './activity-date';
import { ActivityEditError } from './activity-duplicates';

/** Move the existing awarded points; never recalculate them using newer rules. */
export async function editOwnActivityDate(db: PrismaClient, id: string, ownerId: string, value: string, periodStart: Date) {
  const occurredAt = parseActivityDate(value);
  if (!occurredAt) throw new ActivityEditError('Choose a valid activity date, today or earlier.', 400);
  return db.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Activity[]>`SELECT * FROM "Activity" WHERE id = ${id} FOR UPDATE`;
    const activity = rows[0];
    if (!activity) throw new ActivityEditError('Activity not found', 404);
    if (activity.userId !== ownerId) throw new ActivityEditError('Not your activity', 403);
    if (activity.status !== 'APPROVED') throw new ActivityEditError('Only approved entries can use this date editor. Refresh to check its status.', 409);
    if (singaporeDate(activity.occurredAt) === value) return activity;
    const weekStart = getWeekStart(occurredAt);
    const weekNumber = getWeekNumber(occurredAt, periodStart);
    if (weekStart.getTime() !== activity.weekStart.getTime()) {
      const fields = { RUN: 'runPoints', CYCLE: 'cyclePoints', SWIM: 'swimPoints', WALK_OR_HIKE: 'hikePoints', TROOP_GAMES: 'troopGamePoints' } as const;
      const field = fields[activity.category];
      await tx.weeklyScore.update({ where: { userId_weekStart: { userId: ownerId, weekStart: activity.weekStart } }, data: { totalPoints: { decrement: activity.points }, [field]: { decrement: activity.points } } });
      await tx.weeklyScore.upsert({ where: { userId_weekStart: { userId: ownerId, weekStart } }, update: { totalPoints: { increment: activity.points }, [field]: { increment: activity.points } }, create: { userId: ownerId, columnId: activity.columnId, weekStart, weekNumber, totalPoints: activity.points, [field]: activity.points } });
    }
    return tx.activity.update({ where: { id }, data: { occurredAt, weekStart, weekNumber } });
  }, { isolationLevel: 'Serializable' });
}
