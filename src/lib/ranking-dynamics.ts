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

let schemaReady: Promise<void> | null = null;

export function ensureRankingSnapshotSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "RankingSnapshot" (
        "id" TEXT PRIMARY KEY,
        "scope" TEXT NOT NULL,
        "periodKey" TEXT NOT NULL,
        "entityId" TEXT NOT NULL,
        "rank" INTEGER NOT NULL,
        "points" DOUBLE PRECISION NOT NULL,
        "snapshotDate" DATE NOT NULL DEFAULT CURRENT_DATE,
        "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE ("scope", "periodKey", "entityId", "snapshotDate")
      )`);
      await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "RankingSnapshot_lookup_idx" ON "RankingSnapshot" ("scope", "periodKey", "snapshotDate")');
      await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "Activity_approved_column_idx" ON "Activity" ("columnId") WHERE "status"=\'APPROVED\'');
    })().catch((error) => { schemaReady = null; throw error; });
  }
  return schemaReady;
}

export async function getRankingDynamics(scope: string, periodKey: string, entities: RankedEntity[]) {
  await ensureRankingSnapshotSchema();
  const [previousRows, historyRows] = await Promise.all([
    prisma.$queryRawUnsafe(`SELECT "entityId", "rank", "points", "snapshotDate"
      FROM "RankingSnapshot"
      WHERE "scope"=$1 AND "periodKey"=$2
        AND "snapshotDate"=(SELECT MAX("snapshotDate") FROM "RankingSnapshot" WHERE "scope"=$1 AND "periodKey"=$2 AND "snapshotDate" < CURRENT_DATE)`, scope, periodKey) as Promise<SnapshotRow[]>,
    prisma.$queryRawUnsafe(`SELECT "entityId", "rank", "points", "snapshotDate"
      FROM "RankingSnapshot"
      WHERE "scope"=$1 AND "periodKey"=$2 AND "snapshotDate" IN (
        SELECT DISTINCT "snapshotDate" FROM "RankingSnapshot" WHERE "scope"=$1 AND "periodKey"=$2 ORDER BY "snapshotDate" DESC LIMIT 7
      ) ORDER BY "snapshotDate" ASC`, scope, periodKey) as Promise<SnapshotRow[]>,
  ]);

  const previousById = new Map(previousRows.map((row) => [row.entityId, row]));
  const historyById = new Map<string, RankingDynamics['history']>();
  for (const row of historyRows) {
    const history = historyById.get(row.entityId) ?? [];
    history.push({ date: row.snapshotDate.toISOString().slice(0, 10), rank: row.rank, points: row.points });
    historyById.set(row.entityId, history);
  }

  const today = new Date().toISOString().slice(0, 10);
  return new Map(entities.map((entity, index) => {
    const rank = index + 1;
    const previous = previousById.get(entity.id);
    const gap = index > 0 ? Math.max(0, entities[index - 1].points - entity.points) : 0;
    const history = [...(historyById.get(entity.id) ?? [])];
    if (history.at(-1)?.date === today) history[history.length - 1] = { date: today, rank, points: entity.points };
    else history.push({ date: today, rank, points: entity.points });

    return [entity.id, {
      rank,
      previousRank: previous?.rank ?? null,
      rankChange: previous ? previous.rank - rank : null,
      isNew: !previous && entity.points > 0,
      pointsToNext: rank === 1 ? 0 : Math.floor(gap * 2) / 2 + 0.5,
      history: history.slice(-7),
    } satisfies RankingDynamics];
  }));
}

export async function captureRankingSnapshot(scope: string, periodKey: string, entities: RankedEntity[]) {
  if (entities.length === 0) return;
  await ensureRankingSnapshotSchema();
  await prisma.$transaction(entities.map((entity, index) => prisma.$executeRawUnsafe(
    `INSERT INTO "RankingSnapshot" ("id", "scope", "periodKey", "entityId", "rank", "points", "snapshotDate", "capturedAt")
     VALUES ($1,$2,$3,$4,$5,$6,CURRENT_DATE,CURRENT_TIMESTAMP)
     ON CONFLICT ("scope", "periodKey", "entityId", "snapshotDate")
     DO UPDATE SET "rank"=EXCLUDED."rank", "points"=EXCLUDED."points", "capturedAt"=CURRENT_TIMESTAMP`,
    randomUUID(), scope, periodKey, entity.id, index + 1, entity.points,
  )));
}
