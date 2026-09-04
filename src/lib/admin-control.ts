import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { DEFAULT_SCORING_RULES, type ScoringRules } from '@/lib/scoring';

export type ChallengeSettings = {
  id: string;
  challengeName: string;
  startDate: Date;
  endDate: Date;
  weeklyGoal: number;
  scoringRules: ScoringRules;
  updatedAt: Date;
};

export type ControlAnnouncement = { id: string; title: string; message: string; isActive: boolean; createdAt: Date; updatedAt: Date };
export type AuditEntry = { id: string; actorName: string; action: string; target: string; details: Record<string, unknown> | null; createdAt: Date };
export type ManagedColumn = { id: string; name: string; isActive: boolean; memberCount: number; totalPoints: number };

let schemaReady: Promise<void> | null = null;

export function ensureAdminControlSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      await prisma.$executeRawUnsafe('ALTER TABLE "Column" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true');
      await prisma.$executeRawUnsafe('CREATE TABLE IF NOT EXISTS "ChallengeSetting" ("id" TEXT PRIMARY KEY, "challengeName" TEXT NOT NULL, "startDate" TIMESTAMP(3) NOT NULL, "endDate" TIMESTAMP(3) NOT NULL, "weeklyGoal" DOUBLE PRECISION NOT NULL DEFAULT 25, "scoringRules" JSONB NOT NULL, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)');
      await prisma.$executeRawUnsafe('CREATE TABLE IF NOT EXISTS "Announcement" ("id" TEXT PRIMARY KEY, "title" TEXT NOT NULL, "message" TEXT NOT NULL, "isActive" BOOLEAN NOT NULL DEFAULT true, "createdById" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)');
      await prisma.$executeRawUnsafe('CREATE TABLE IF NOT EXISTS "AdminAudit" ("id" TEXT PRIMARY KEY, "actorId" TEXT NOT NULL, "actorName" TEXT NOT NULL, "action" TEXT NOT NULL, "target" TEXT NOT NULL, "details" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)');
      await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "AdminAudit_createdAt_idx" ON "AdminAudit"("createdAt")');
    })().catch((error) => { schemaReady = null; throw error; });
  }
  return schemaReady;
}

export async function getChallengeSettings(): Promise<ChallengeSettings> {
  await ensureAdminControlSchema();
  const rows = await prisma.$queryRawUnsafe('SELECT * FROM "ChallengeSetting" WHERE "id" = $1 LIMIT 1', 'primary') as ChallengeSettings[];
  if (rows[0]) return { ...rows[0], scoringRules: { ...DEFAULT_SCORING_RULES, ...rows[0].scoringRules } };
  await prisma.$executeRawUnsafe('INSERT INTO "ChallengeSetting" ("id", "challengeName", "startDate", "endDate", "weeklyGoal", "scoringRules") VALUES ($1,$2,$3,$4,$5,$6::jsonb) ON CONFLICT DO NOTHING', 'primary', 'Kilo Golf Stay Active Challenge', new Date('2026-08-16T00:00:00Z'), new Date('2026-12-31T23:59:59Z'), 25, JSON.stringify(DEFAULT_SCORING_RULES));
  return getChallengeSettings();
}

export async function getAnnouncements(activeOnly = false) {
  await ensureAdminControlSchema();
  return prisma.$queryRawUnsafe(`SELECT "id", "title", "message", "isActive", "createdAt", "updatedAt" FROM "Announcement" ${activeOnly ? 'WHERE "isActive" = true' : ''} ORDER BY "createdAt" DESC`) as Promise<ControlAnnouncement[]>;
}

export async function getAuditEntries(limit = 25) {
  await ensureAdminControlSchema();
  return prisma.$queryRawUnsafe('SELECT "id", "actorName", "action", "target", "details", "createdAt" FROM "AdminAudit" ORDER BY "createdAt" DESC LIMIT $1', limit) as Promise<AuditEntry[]>;
}

export async function getManagedColumns() {
  await ensureAdminControlSchema();
  return prisma.$queryRawUnsafe(`SELECT c."id", c."name", c."isActive",
    (SELECT COUNT(*)::int FROM "User" u WHERE u."columnId" = c."id") AS "memberCount",
    (SELECT COALESCE(SUM(ws."totalPoints"), 0)::float8 FROM "WeeklyScore" ws WHERE ws."columnId" = c."id") AS "totalPoints"
    FROM "Column" c ORDER BY c."name"`) as Promise<ManagedColumn[]>;
}

export async function getActiveColumnIds(): Promise<string[]> {
  await ensureAdminControlSchema();
  const rows = await prisma.$queryRawUnsafe('SELECT "id" FROM "Column" WHERE "isActive"=true') as Array<{ id: string }>;
  return rows.map((row) => row.id);
}

export async function recordAdminAudit(actorId: string, action: string, target: string, details: Record<string, unknown> = {}) {
  await ensureAdminControlSchema();
  const actor = await prisma.user.findUnique({ where: { id: actorId }, select: { name: true } });
  return prisma.$executeRawUnsafe('INSERT INTO "AdminAudit" ("id", "actorId", "actorName", "action", "target", "details") VALUES ($1,$2,$3,$4,$5,$6::jsonb)', randomUUID(), actorId, actor?.name || 'Administrator', action, target, JSON.stringify(details));
}
