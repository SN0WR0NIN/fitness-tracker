import type { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { DEFAULT_SCORING_RULES, type ScoringRules } from './scoring';
import { planDailyActivityScores } from './daily-friend-bonus';
import { assertCompetitionWritable, FeatureError } from './operating-mode';
import { isRetryableScoringConflict } from './scoring-conflicts';

const fields = { RUN: 'runPoints', CYCLE: 'cyclePoints', SWIM: 'swimPoints', WALK_OR_HIKE: 'hikePoints', TROOP_GAMES: 'troopGamePoints' } as const;
export async function scoringTransaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await prisma.$transaction(work, { isolationLevel: 'Serializable', timeout: 40000, maxWait: 5000 });
    } catch (error) {
      if (!isRetryableScoringConflict(error)) throw error;
      if (attempt === 3) throw new FeatureError('Another review changed these scores. Refresh and retry.', 409);
      await new Promise(resolve => setTimeout(resolve, 30 * (attempt + 1)));
    }
  }
  throw new FeatureError('Please retry the change.', 409);
}

export async function ledgerSettings(tx: Prisma.TransactionClient) {
  const rows = await tx.$queryRaw<Array<{ scoringRules: Partial<ScoringRules>; startDate: Date }>>`SELECT "scoringRules", "startDate" FROM "ChallengeSetting" WHERE id='primary' FOR SHARE`;
  if (!rows[0]) throw new FeatureError('Challenge settings unavailable.', 503);
  return { rules: { ...DEFAULT_SCORING_RULES, ...rows[0].scoringRules }, startDate: rows[0].startDate };
}

/** Must execute INSIDE the same serializable transaction as the activity
 * mutation. Rebuild from approved facts, never increment a guessed bonus.
 * Deferred achievement triggers evaluate the final committed allocation. */
export async function reconcileParticipantScores(tx: Prisma.TransactionClient, userId: string,
  settings?: { rules: ScoringRules; startDate: Date }) {
  await assertCompetitionWritable(tx);
  const configuration = settings ?? await ledgerSettings(tx);
  const activities = await tx.activity.findMany({ where: { userId }, include: { pointsLog: true } });
  const existingScores = await tx.weeklyScore.findMany({ where: { userId } });
  const plan = planDailyActivityScores(activities, configuration.rules, configuration.startDate);
  // Remove displaced bonuses before awarding replacements. Achievement checks
  // are deferred until commit as mutations before this loop can also reallocate.
  plan.sort((a,b) => (a.scoring.totalPoints-a.activity.points)-(b.scoring.totalPoints-b.activity.points));
  const changed: Array<{ activityId: string; oldPoints: number; newPoints: number; friendBonus: number }> = [];
  const totals = new Map<string, { columnId: string; weekStart: Date; weekNumber: number; totalPoints: number;
    runPoints: number; cyclePoints: number; swimPoints: number; hikePoints: number; troopGamePoints: number }>();
  for (const item of plan) {
    const { activity, category, scoring, weekStart, weekNumber } = item;
    if (activity.points !== scoring.totalPoints || activity.category !== category
      || activity.weekStart.getTime() !== weekStart.getTime() || activity.weekNumber !== weekNumber) {
      await tx.activity.update({ where: { id: activity.id }, data: { points: scoring.totalPoints, category, weekStart, weekNumber } });
      changed.push({ activityId: activity.id, oldPoints: activity.points, newPoints: scoring.totalPoints, friendBonus: scoring.friendBonus });
    }
    if (!activity.pointsLog || activity.pointsLog.basePoints !== scoring.basePoints
      || activity.pointsLog.friendBonus !== scoring.friendBonus || activity.pointsLog.totalPoints !== scoring.totalPoints) {
      await tx.pointsLog.upsert({ where: { activityId: activity.id },
        create: { activityId: activity.id, ...scoring }, update: scoring });
    }
    if (activity.status !== 'APPROVED') continue;
    const key = weekStart.toISOString();
    const row = totals.get(key) ?? { columnId: existingScores.find(s => s.weekStart.getTime() === weekStart.getTime())?.columnId ?? activity.columnId,
      weekStart, weekNumber, totalPoints: 0, runPoints: 0, cyclePoints: 0, swimPoints: 0, hikePoints: 0, troopGamePoints: 0 };
    row.totalPoints += scoring.totalPoints;
    row[fields[category]] += scoring.totalPoints;
    totals.set(key, row);
  }
  // Retain old zero weeks/history when a correction moves the last activity.
  for (const score of existingScores) if (!totals.has(score.weekStart.toISOString())) {
    totals.set(score.weekStart.toISOString(), { columnId: score.columnId, weekStart: score.weekStart,
      weekNumber: score.weekNumber, totalPoints: 0, runPoints: 0, cyclePoints: 0, swimPoints: 0, hikePoints: 0, troopGamePoints: 0 });
  }
  for (const row of totals.values()) {
    const previous = existingScores.find(s => s.weekStart.getTime() === row.weekStart.getTime());
    const { weekStart, ...data } = row;
    if (!previous || Object.entries(data).some(([key, value]) => previous[key as keyof typeof previous] !== value)) {
      await tx.weeklyScore.upsert({ where: { userId_weekStart: { userId, weekStart } }, create: { userId, weekStart, ...data }, update: data });
    }
  }
  return { changed, activities: plan.length, weeklyScores: totals.size };
}
