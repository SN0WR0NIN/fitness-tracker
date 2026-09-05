import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { categoryField, type ImportRow, type prepareRow } from './historical-import';

type SelectedRow = Omit<ImportRow, 'occurredAt' | 'category'> & ReturnType<typeof prepareRow> & {
  userId: string;
  columnId: string;
  createParticipant: boolean;
};

// The caller owns the serializable transaction: never commit a partial import.
export async function writeHistoricalImport(tx: Prisma.TransactionClient, rows: SelectedRow[], reviewerId: string) {
  if (!rows.length) return;
  const participants = new Map<string, Prisma.UserCreateManyInput>();
  const scores = new Map<string, {
    id: string; userId: string; columnId: string; weekStart: Date; weekNumber: number;
    totalPoints: number; runPoints: number; cyclePoints: number; swimPoints: number; hikePoints: number; troopGamePoints: number;
  }>();
  const reviewedAt = new Date();
  const activities = rows.map((row) => {
    const { userId, columnId } = row;
    if (row.createParticipant && !participants.has(userId)) {
      participants.set(userId, { id: userId, name: row.name, email: `${userId}@participants.invalid`, password: '!UNCLAIMED', columnId });
    }
    const key = JSON.stringify([userId, row.weekStart.toISOString()]);
    const score = scores.get(key) ?? {
      id: randomUUID(), userId, columnId, weekStart: row.weekStart, weekNumber: row.weekNumber,
      totalPoints: 0, runPoints: 0, cyclePoints: 0, swimPoints: 0, hikePoints: 0, troopGamePoints: 0,
    };
    score.totalPoints += row.points;
    score[categoryField[row.category]] += row.points;
    scores.set(key, score);
    return {
      id: row.id, userId, columnId, category: row.category, distance: row.distance,
      pace: row.pace, companion: row.companion, completedWithFriend: Boolean(row.companion),
      proofUrl: row.proofUrl, points: row.points, occurredAt: row.occurredAt,
      weekStart: row.weekStart, weekNumber: row.weekNumber, status: 'APPROVED' as const,
      reviewedById: reviewerId, reviewedAt,
    };
  });
  if (participants.size) await tx.user.createMany({ data: [...participants.values()], skipDuplicates: true });
  // Do not skip activity conflicts: a concurrent import must roll back scores too.
  await tx.activity.createMany({ data: activities });
  const values = [...scores.values()].map((s) => Prisma.sql`(
    ${s.id}, ${s.userId}, ${s.columnId}, ${s.weekStart}, ${s.weekNumber},
    ${s.totalPoints}, ${s.runPoints}, ${s.cyclePoints}, ${s.swimPoints}, ${s.hikePoints}, ${s.troopGamePoints},
    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  )`);
  await tx.$executeRaw(Prisma.sql`
    INSERT INTO "WeeklyScore" ("id", "userId", "columnId", "weekStart", "weekNumber",
      "totalPoints", "runPoints", "cyclePoints", "swimPoints", "hikePoints", "troopGamePoints", "createdAt", "updatedAt")
    VALUES ${Prisma.join(values)}
    ON CONFLICT ("userId", "weekStart") DO UPDATE SET
      "totalPoints" = "WeeklyScore"."totalPoints" + EXCLUDED."totalPoints",
      "runPoints" = "WeeklyScore"."runPoints" + EXCLUDED."runPoints",
      "cyclePoints" = "WeeklyScore"."cyclePoints" + EXCLUDED."cyclePoints",
      "swimPoints" = "WeeklyScore"."swimPoints" + EXCLUDED."swimPoints",
      "hikePoints" = "WeeklyScore"."hikePoints" + EXCLUDED."hikePoints",
      "troopGamePoints" = "WeeklyScore"."troopGamePoints" + EXCLUDED."troopGamePoints",
      "updatedAt" = CURRENT_TIMESTAMP
  `);
}
