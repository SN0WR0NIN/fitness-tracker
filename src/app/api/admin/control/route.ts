import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { requireAdmin } from '@/lib/adminGuard';
import { ensureAdminControlSchema, getChallengeSettings, recordAdminAudit } from '@/lib/admin-control';
import { recalculateAllScores } from '@/lib/activities';
import { prisma } from '@/lib/prisma';
import { requestLog } from '@/lib/telemetry';

const ScoringRulesSchema = z.object({
  runBasePerKm: z.number().min(0).max(20), runFastBonusPerKm: z.number().min(0).max(20), runMediumBonusPerKm: z.number().min(0).max(20), runStandardBonusPerKm: z.number().min(0).max(20),
  runFastPaceThreshold: z.number().positive().max(30), runMediumPaceThreshold: z.number().positive().max(30), runSlowPaceThreshold: z.number().positive().max(30),
  cycleKmPerPoint: z.number().positive().max(1000), swimMetersPerPoint: z.number().positive().max(10000), walkPointsPerKm: z.number().min(0).max(20), walkMinimumKm: z.number().min(0).max(1000), troopGamePoints: z.number().min(0).max(1000), friendBonus: z.number().min(0).max(1000),
}).refine((rules) => rules.runFastPaceThreshold < rules.runMediumPaceThreshold && rules.runMediumPaceThreshold < rules.runSlowPaceThreshold, { message: 'Pace thresholds must increase from fast to medium to slow' });

const SettingsSchema = z.object({ challengeName: z.string().trim().min(3).max(100), startDate: z.coerce.date(), endDate: z.coerce.date(), weeklyGoal: z.number().positive().max(10000), maintenanceMode: z.boolean(), maintenanceMessage: z.string().trim().min(3).max(240), scoringRules: ScoringRulesSchema }).refine((settings) => settings.endDate > settings.startDate, { message: 'End date must be after start date' });
const RequestSchema = z.object({ action: z.enum(['settings.update', 'announcement.create', 'announcement.toggle', 'announcement.delete', 'column.create', 'column.update', 'scores.recalculate']), payload: z.record(z.string(), z.unknown()).default({}) });

export async function POST(request: Request) {
  const log = requestLog(request, '/api/admin/control');
  const guard = await requireAdmin();
  if (guard.error) {
    log.success({ status: guard.status });
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  try {
    await ensureAdminControlSchema();
    const { action, payload } = RequestSchema.parse(await request.json());
    if (action === 'settings.update') {
      const data = SettingsSchema.parse(payload);
      await getChallengeSettings();
      await prisma.$executeRawUnsafe('UPDATE "ChallengeSetting" SET "challengeName"=$1,"startDate"=$2,"endDate"=$3,"weeklyGoal"=$4,"scoringRules"=$5::jsonb,"maintenanceMode"=$6,"maintenanceMessage"=$7,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$8', data.challengeName, data.startDate, data.endDate, data.weeklyGoal, JSON.stringify(data.scoringRules), data.maintenanceMode, data.maintenanceMessage, 'primary');
      await recordAdminAudit(guard.userId, 'Updated challenge settings', data.challengeName, { maintenanceMode: data.maintenanceMode });
      log.success({ status: 200, action });
      return NextResponse.json({ success: true });
    }
    if (action === 'announcement.create') {
      const data = z.object({ title: z.string().trim().min(3).max(80), message: z.string().trim().min(3).max(500) }).parse(payload);
      const id = randomUUID();
      await prisma.$executeRawUnsafe('INSERT INTO "Announcement" ("id","title","message","createdById") VALUES ($1,$2,$3,$4)', id, data.title, data.message, guard.userId);
      await recordAdminAudit(guard.userId, 'Published announcement', data.title);
      log.success({ status: 200, action });
      return NextResponse.json({ success: true, id });
    }
    if (action === 'announcement.toggle') {
      const data = z.object({ id: z.string(), isActive: z.boolean() }).parse(payload);
      await prisma.$executeRawUnsafe('UPDATE "Announcement" SET "isActive"=$1,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$2', data.isActive, data.id);
      await recordAdminAudit(guard.userId, data.isActive ? 'Activated announcement' : 'Paused announcement', data.id);
      log.success({ status: 200, action });
      return NextResponse.json({ success: true });
    }
    if (action === 'announcement.delete') {
      const data = z.object({ id: z.string() }).parse(payload);
      await prisma.$executeRawUnsafe('DELETE FROM "Announcement" WHERE "id"=$1', data.id);
      await recordAdminAudit(guard.userId, 'Deleted announcement', data.id);
      log.success({ status: 200, action });
      return NextResponse.json({ success: true });
    }
    if (action === 'column.create') {
      const data = z.object({ name: z.string().trim().min(2).max(50) }).parse(payload);
      const column = await prisma.column.create({ data: { name: data.name }, select: { id: true, name: true } });
      await recordAdminAudit(guard.userId, 'Created column', data.name);
      log.success({ status: 200, action });
      return NextResponse.json(column);
    }
    if (action === 'column.update') {
      const data = z.object({ id: z.string(), name: z.string().trim().min(2).max(50), isActive: z.boolean() }).parse(payload);
      const remaining = await prisma.$queryRawUnsafe('SELECT COUNT(*)::int AS count FROM "Column" WHERE "isActive"=true AND "id"<>$1', data.id) as Array<{ count: number }>;
      if (!data.isActive && !remaining[0]?.count) return NextResponse.json({ error: 'At least one column must remain active' }, { status: 400 });
      await prisma.$executeRawUnsafe('UPDATE "Column" SET "name"=$1,"isActive"=$2,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$3', data.name, data.isActive, data.id);
      await recordAdminAudit(guard.userId, 'Updated column', data.name, { isActive: data.isActive });
      log.success({ status: 200, action });
      return NextResponse.json({ success: true });
    }
    z.object({ confirmation: z.literal('RECALCULATE') }).parse(payload);
    const settings = await getChallengeSettings();
    const result = await recalculateAllScores(settings.scoringRules, settings.startDate);
    await recordAdminAudit(guard.userId, 'Recalculated all standings', 'Scores', result);
    log.success({ status: 200, action });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof ZodError) {
      log.success({ status: 400, validationError: error.issues[0]?.message });
      return NextResponse.json({ error: error.issues[0]?.message || 'Invalid request' }, { status: 400 });
    }
    log.failure(error);
    return NextResponse.json({ error: 'Unable to complete the admin action' }, { status: 500 });
  }
}
