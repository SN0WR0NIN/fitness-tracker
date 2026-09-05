import type { PrismaClient, Activity } from '@prisma/client';

export class ActivityDeletionError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

/** Lock the submission before reading its status, so reviews and repeated deletes
 * cannot deduct points twice. Score changes and removal commit together. */
export async function deleteOwnActivity(db: PrismaClient, id: string, ownerId: string) {
  return db.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Activity[]>`SELECT * FROM "Activity" WHERE id = ${id} FOR UPDATE`;
    const activity = rows[0];
    if (!activity) throw new ActivityDeletionError('Activity not found', 404);
    if (activity.userId !== ownerId) throw new ActivityDeletionError('Not your activity', 403);
    if (activity.status === 'APPROVED') {
      const fields = { RUN: 'runPoints', CYCLE: 'cyclePoints', SWIM: 'swimPoints', WALK_OR_HIKE: 'hikePoints', TROOP_GAMES: 'troopGamePoints' } as const;
      await tx.weeklyScore.update({
        where: { userId_weekStart: { userId: ownerId, weekStart: activity.weekStart } },
        data: { totalPoints: { decrement: activity.points }, [fields[activity.category]]: { decrement: activity.points } },
      });
    }
    await tx.activity.delete({ where: { id } });
  });
}
