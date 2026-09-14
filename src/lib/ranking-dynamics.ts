import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';

type RankedEntity = { id: string; points: number };
type SnapshotRow = { entityId: string; rank: number; points: number; snapshotDate: Date };

export type RankingDynamics = {
  rank: number;
  previousRank: number | null;
  rankChange: number | null;
  isNew: boolean;
  pointsToNext: number;
  history: Array<{ date: string; rank: number; points: number }>;
};

// RankingSnapshot is now guaranteed by a database migration. Keep the exported
// no-op for compatibility with existing call sites without running DDL on reads.
export async function ensureRankingSnapshotSchema() {}

function singaporeDateKey(date = new Date()) {
  const local = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, '0')}-${String(local.getUTCDate()).padStart(2, '0')}`;
}

function currentSingaporeWeekStart() {
  const local = new Date(Date.now() + 8 * 60 * 60 * 1000);
  local.setUTCHours(0, 0, 0, 0);
  local.setUTCDate(local.getUTCDate() - local.getUTCDay());
  return local;
}

/**
 * Rank movement is measured from one fixed position for the whole challenge
 * week. Prefer the last captured position before the week starts (the position
 * carried into the new week). If no earlier snapshot exists, use the first
 * snapshot captured during that week as the baseline.
 */
export async function getRankingDynamics(
  scope: string,
  periodKey: string,
  entities: RankedEntity[],
  baselineStart: Date = currentSingaporeWeekStart(),
) {
  const baselineDate = baselineStart.toISOString().slice(0, 10);
  const [baselineRows, historyRows] = await Promise.all([
    prisma.$queryRawUnsafe(`WITH baseline_date AS (
        SELECT COALESCE(
          (SELECT MAX("snapshotDate") FROM "RankingSnapshot"
            WHERE "scope"=$1 AND "periodKey"=$2 AND "snapshotDate" < $3::date),
          (SELECT MIN("snapshotDate") FROM "RankingSnapshot"
            WHERE "scope"=$1 AND "periodKey"=$2 AND "snapshotDate" >= $3::date)
        ) AS "snapshotDate"
      )
      SELECT "entityId", "rank", "points", "snapshotDate"
      FROM "RankingSnapshot"
      WHERE "scope"=$1 AND "periodKey"=$2
        AND "snapshotDate"=(SELECT "snapshotDate" FROM baseline_date)`, scope, periodKey, baselineDate) as Promise<SnapshotRow[]>,
    prisma.$queryRawUnsafe(`SELECT "entityId", "rank", "points", "snapshotDate"
      FROM "RankingSnapshot"
      WHERE "scope"=$1 AND "periodKey"=$2 AND "snapshotDate" IN (
        SELECT DISTINCT "snapshotDate" FROM "RankingSnapshot" WHERE "scope"=$1 AND "periodKey"=$2 ORDER BY "snapshotDate" DESC LIMIT 7
      ) ORDER BY "snapshotDate" ASC`, scope, periodKey) as Promise<SnapshotRow[]>,
  ]);

  const baselineById = new Map(baselineRows.map((row) => [row.entityId, row]));
  const historyById = new Map<string, RankingDynamics['history']>();
  for (const row of historyRows) {
    const history = historyById.get(row.entityId) ?? [];
    history.push({ date: row.snapshotDate.toISOString().slice(0, 10), rank: row.rank, points: row.points });
    historyById.set(row.entityId, history);
  }

  const today = singaporeDateKey();
  return new Map(entities.map((entity, index) => {
    const rank = index + 1;
    const baseline = baselineById.get(entity.id);
    const gap = index > 0 ? Math.max(0, entities[index - 1].points - entity.points) : 0;
    const history = [...(historyById.get(entity.id) ?? [])];
    if (history.at(-1)?.date === today) history[history.length - 1] = { date: today, rank, points: entity.points };
    else history.push({ date: today, rank, points: entity.points });

    return [entity.id, {
      rank,
      previousRank: baseline?.rank ?? null,
      rankChange: baseline ? baseline.rank - rank : null,
      isNew: !baseline && entity.points > 0,
      pointsToNext: rank === 1 ? 0 : Math.floor(gap * 2) / 2 + 0.5,
      history: history.slice(-7),
    } satisfies RankingDynamics];
  }));
}

export async function captureRankingSnapshot(scope: string, periodKey: string, entities: RankedEntity[]) {
  if (entities.length === 0) return;
  await prisma.$transaction(entities.map((entity, index) => prisma.$executeRawUnsafe(
    `INSERT INTO "RankingSnapshot" ("id", "scope", "periodKey", "entityId", "rank", "points", "snapshotDate", "capturedAt")
     VALUES ($1,$2,$3,$4,$5,$6,(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Singapore')::date,CURRENT_TIMESTAMP)
     ON CONFLICT ("scope", "periodKey", "entityId", "snapshotDate") DO NOTHING`,
    randomUUID(), scope, periodKey, entity.id, index + 1, entity.points,
  )));
}
