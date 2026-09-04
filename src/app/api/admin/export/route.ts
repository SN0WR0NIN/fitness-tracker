import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';
import { prisma } from '@/lib/prisma';

const csvCell = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
const csv = (rows: unknown[][]) => rows.map((row) => row.map(csvCell).join(',')).join('\n');

export async function GET(request: NextRequest) {
  const guard = await requireAdmin();
  if (guard.error) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const type = request.nextUrl.searchParams.get('type') || 'activities';
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
  return new NextResponse(csv(rows), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="kg-${type}-${new Date().toISOString().slice(0, 10)}.csv"` } });
}
