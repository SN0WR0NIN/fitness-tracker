import { cache } from 'react';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { DEFAULT_SCORING_RULES, type ScoringRules } from '@/lib/scoring';

export type ChallengeSettings = {
  id: string;
  challengeName: string;
  startDate: Date;
  endDate: Date;
  weeklyGoal: number;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  scoringRules: ScoringRules;
  updatedAt: Date;
};

export type ControlAnnouncement = { id: string; title: string; message: string; isActive: boolean; createdAt: Date; updatedAt: Date };
export type AuditEntry = { id: string; actorName: string; action: string; target: string; details: Record<string, unknown> | null; createdAt: Date };
export type ManagedColumn = { id: string; name: string; isActive: boolean; memberCount: number; totalPoints: number };

// The control schema is managed by database migrations. Keep this exported
// no-op for existing callers without doing DDL during normal request handling.
export async function ensureAdminControlSchema() {}

async function getChallengeSettingsUncached(): Promise<ChallengeSettings> {
  const rows = await prisma.$queryRawUnsafe('SELECT * FROM "ChallengeSetting" WHERE "id" = $1 LIMIT 1', 'primary') as ChallengeSettings[];
  if (rows[0]) return { ...rows[0], maintenanceMode: Boolean(rows[0].maintenanceMode), maintenanceMessage: rows[0].maintenanceMessage || 'New activity submissions are temporarily paused.', scoringRules: { ...DEFAULT_SCORING_RULES, ...rows[0].scoringRules } };
  await prisma.$executeRawUnsafe('INSERT INTO "ChallengeSetting" ("id", "challengeName", "startDate", "endDate", "weeklyGoal", "scoringRules") VALUES ($1,$2,$3,$4,$5,$6::jsonb) ON CONFLICT DO NOTHING', 'primary', 'Kilo Golf Stay Active Challenge', new Date('2026-09-01T00:00:00Z'), new Date('2026-12-31T23:59:59Z'), 25, JSON.stringify(DEFAULT_SCORING_RULES));
  const createdRows = await prisma.$queryRawUnsafe('SELECT * FROM "ChallengeSetting" WHERE "id" = $1 LIMIT 1', 'primary') as ChallengeSettings[];
  const created = createdRows[0];
  if (!created) throw new Error('Challenge settings are unavailable.');
  return { ...created, maintenanceMode: Boolean(created.maintenanceMode), maintenanceMessage: created.maintenanceMessage || 'New activity submissions are temporarily paused.', scoringRules: { ...DEFAULT_SCORING_RULES, ...created.scoringRules } };
}

export async function getAnnouncements(activeOnly = false) {
  return prisma.$queryRawUnsafe(`SELECT "id", "title", "message", "isActive", "createdAt", "updatedAt" FROM "Announcement" ${activeOnly ? 'WHERE "isActive" = true' : ''} ORDER BY "createdAt" DESC`) as Promise<ControlAnnouncement[]>;
}

export async function getAuditEntries(limit = 25) {
  return prisma.$queryRawUnsafe('SELECT "id", "actorName", "action", "target", "details", "createdAt" FROM "AdminAudit" ORDER BY "createdAt" DESC LIMIT $1', limit) as Promise<AuditEntry[]>;
}

export async function getManagedColumns() {
  return prisma.$queryRawUnsafe(`SELECT c."id", c."name", c."isActive",
    (SELECT COUNT(*)::int FROM "User" u WHERE u."columnId" = c."id") AS "memberCount",
    (SELECT COALESCE(SUM(ws."totalPoints"), 0)::float8 FROM "WeeklyScore" ws WHERE ws."columnId" = c."id") AS "totalPoints"
    FROM "Column" c ORDER BY c."name"`) as Promise<ManagedColumn[]>;
}

export async function getActiveColumnIds(): Promise<string[]> {
  const rows = await prisma.$queryRawUnsafe('SELECT "id" FROM "Column" WHERE "isActive"=true') as Array<{ id: string }>;
  return rows.map((row) => row.id);
}

export async function recordAdminAudit(actorId: string, action: string, target: string, details: Record<string, unknown> = {}) {
  const actor = await prisma.user.findUnique({ where: { id: actorId }, select: { name: true } });
  return prisma.$executeRawUnsafe('INSERT INTO "AdminAudit" ("id", "actorId", "actorName", "action", "target", "details") VALUES ($1,$2,$3,$4,$5,$6::jsonb)', randomUUID(), actorId, actor?.name || 'Administrator', action, target, JSON.stringify(details));
}

export const getChallengeSettings = cache(getChallengeSettingsUncached);
