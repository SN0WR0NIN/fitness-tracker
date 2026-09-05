import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';
import { prisma } from '@/lib/prisma';
import { getAnnouncements, getAuditEntries, getChallengeSettings, getManagedColumns, recordAdminAudit } from '@/lib/admin-control';
import { requestLog } from '@/lib/telemetry';

const csvCell = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
const csv = (rows: unknown[][]) => rows.map((row) => row.map(csvCell).join(',')).join('\n');

export async function GET(request: NextRequest) {
  const log = requestLog(request, '/api/admin/export');
  const guard = await requireAdmin();
  if (guard.error) {
    log.success({ status: guard.status });
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const type = request.nextUrl.searchParams.get('type') || 'activities';
  if (type === 'backup') {
    try {
      const [settings, announcements, columns, users, activities, weeklyScores, profileSettings, weeklyGoals, rankingSnapshots, audit] = await Promise.all([
        getChallengeSettings(),
        getAnnouncements(),
        getManagedColumns(),
        prisma.user.findMany({ select: { id: true, name: true, email: true, role: true, columnId: true, stravaAthleteId: true, createdAt: true, updatedAt: true }, orderBy: { name: 'asc' } }),
        prisma.activity.findMany({ select: { id: true, userId: true, columnId: true, category: true, distance: true, pace: true, duration: true, completedWithFriend: true, companion: true, companionUserId: true, proofUrl: true, points: true, status: true, reviewedById: true, reviewedAt: true, rejectionReason: true, occurredAt: true, weekStart: true, weekNumber: true, stravaActivityId: true, elevationGain: true, createdAt: true, updatedAt: true }, orderBy: { occurredAt: 'desc' } }),
        prisma.weeklyScore.findMany({ orderBy: [{ weekNumber: 'asc' }, { totalPoints: 'desc' }] }),
        prisma.$queryRawUnsafe('SELECT "userId", "weeklyGoal", "bio", "profilePhotoUrl", "createdAt", "updatedAt" FROM "UserProfileSettings" ORDER BY "userId"'),
        prisma.$queryRawUnsafe('SELECT "userId", "weekStart", "target", "createdAt", "updatedAt" FROM "WeeklyGoal" ORDER BY "weekStart", "userId"'),
        prisma.$queryRawUnsafe('SELECT "id", "scope", "periodKey", "entityId", "rank", "points", "snapshotDate", "capturedAt" FROM "RankingSnapshot" ORDER BY "capturedAt"'),
        getAuditEntries(10000),
      ]);
      const backup = {
        format: 'kg-stay-active-operational-backup',
        version: 1,
        exportedAt: new Date().toISOString(),
        excludes: ['passwords', 'Strava access tokens', 'Strava refresh tokens'],
        challenge: settings,
        announcements,
        columns,
        users,
        activities,
        weeklyScores,
        profileSettings,
        weeklyGoals,
        rankingSnapshots,
        audit,
      };
      try {
        await recordAdminAudit(guard.userId, 'BACKUP_EXPORT', 'Operational backup', {
          users: users.length,
          activities: activities.length,
          weeklyScores: weeklyScores.length,
          profileSettings: Array.isArray(profileSettings) ? profileSettings.length : 0,
          weeklyGoals: Array.isArray(weeklyGoals) ? weeklyGoals.length : 0,
          rankingSnapshots: Array.isArray(rankingSnapshots) ? rankingSnapshots.length : 0,
        });
      } catch (auditError) {
        console.warn('Backup export completed but audit entry could not be recorded.', auditError);
      }
      log.success({ status: 200, type, users: users.length, activities: activities.length });
      return new NextResponse(JSON.stringify(backup, null, 2), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': `attachment; filename="kg-backup-${new Date().toISOString().slice(0, 10)}.json"`, 'Cache-Control': 'no-store' } });
    } catch (error) {
      log.failure(error, { type });
      return NextResponse.json({ error: 'Unable to create backup export' }, { status: 500 });
    }
  }
  let rows: unknown[][];
  if (type === 'users') {
    const users = await prisma.user.findMany({ include: { column: true }, orderBy: { name: 'asc' } });
    rows = [['Name', 'Email', 'Role', 'Column', 'Strava connected', 'Joined'], ...users.map((user: { name: string; email: string; role: string; column: { name: string } | null; stravaAthleteId: string | null; createdAt: Date }) => [user.name, user.email, user.role, user.column?.name, user.stravaAthleteId ? 'Yes' : 'No', user.createdAt.toISOString()])];
  } else if (type === 'standings') {
    const scores = await prisma.weeklyScore.findMany({ include: { user: { include: { column: true } } }, orderBy: { totalPoints: 'desc' } });
    rows = [['Athlete', 'Column', 'Week', 'Total points', 'Run', 'Cycle', 'Swim', 'Walk/Hike', 'Troop Games'], ...scores.map((score: { user: { name: string; column: { name: string } | null }; weekNumber: number; totalPoints: number; runPoints: number; cyclePoints: number; swimPoints: number; hikePoints: number; troopGamePoints: number }) => [score.user.name, score.user.column?.name, score.weekNumber, score.totalPoints, score.runPoints, score.cyclePoints, score.swimPoints, score.hikePoints, score.troopGamePoints])];
  } else {
    const activities = await prisma.activity.findMany({ include: { user: true, column: true }, orderBy: { occurredAt: 'desc' } });
    rows = [['Athlete', 'Column', 'Activity', 'Distance', 'Pace', 'Points', 'Status', 'Date'], ...activities.map((activity: { user: { name: string }; column: { name: string }; category: string; distance: number; pace: number | null; points: number; status: string; occurredAt: Date }) => [activity.user.name, activity.column.name, activity.category, activity.distance, activity.pace, activity.points, activity.status, activity.occurredAt.toISOString()])];
  }
  log.success({ status: 200, type, rows: rows.length - 1 });
  return new NextResponse(csv(rows), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="kg-${type}-${new Date().toISOString().slice(0, 10)}.csv"`, 'Cache-Control': 'no-store' } });
}
