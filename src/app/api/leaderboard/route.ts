import { after, NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getActiveColumnIds } from '@/lib/admin-control';
import { captureRankingSnapshot, getRankingDynamics } from '@/lib/ranking-dynamics';
import { requestLog, timed } from '@/lib/telemetry';

type WeeklyScoreRow = {
  userId: string;
  totalPoints: number;
  runPoints: number;
  cyclePoints: number;
  swimPoints: number;
  hikePoints: number;
  troopGamePoints: number;
  user: {
    name: string;
    column: { name: string } | null;
  } | null;
};

type TeamColumn = {
  id: string;
  name: string;
  _count: { members: number };
};

type TeamActivityTotal = { columnId: string; _sum: { points: number | null } };

function scheduleRankingCapture(scope: string, periodKey: string, entities: Array<{ id: string; points: number }>) {
  after(async () => {
    try {
      await captureRankingSnapshot(scope, periodKey, entities);
    } catch (error) {
      console.error('Failed to capture ranking snapshot:', error);
    }
  });
}

export async function GET(request: NextRequest) {
  const log = requestLog(request, '/api/leaderboard');
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'individual';
    const weekNumber = searchParams.get('weekNumber');
    const timingMeta = { route: '/api/leaderboard', type, period: weekNumber ? `week:${weekNumber}` : 'all-time' };

    if (type === 'individual') {
      const response = await timed('perf.leaderboard.individual.total', () => getIndividualLeaderboard(weekNumber), timingMeta);
      log.success({ status: response.status, type, weekNumber });
      return response;
    }
    if (type === 'team') {
      const response = await timed('perf.leaderboard.team.total', () => getTeamLeaderboard(weekNumber), timingMeta);
      log.success({ status: response.status, type, weekNumber });
      return response;
    }

    log.success({ status: 400, type });
    return NextResponse.json({ error: 'Invalid leaderboard type' }, { status: 400 });
  } catch (error) {
    log.failure(error, { status: 500 });
    return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 });
  }
}

async function getIndividualLeaderboard(weekNumber: string | null) {
  const where: { weekNumber?: number } = {};
  if (weekNumber) {
    const parsed = Number.parseInt(weekNumber, 10);
    if (!Number.isFinite(parsed) || parsed < 1) return NextResponse.json({ error: 'Invalid week number' }, { status: 400 });
    where.weekNumber = parsed;
  }
  const meta = { route: '/api/leaderboard', type: 'individual', period: weekNumber ? `week:${weekNumber}` : 'all-time' };

  const weeklyScores = await timed('perf.leaderboard.individual.scores', () => prisma.weeklyScore.findMany({
    where,
    include: {
      user: {
        select: { id: true, name: true, column: { select: { name: true } } },
      },
    },
    orderBy: { totalPoints: 'desc' },
  }), meta) as WeeklyScoreRow[];

  const userScores = new Map<string, {
    userId: string;
    userName: string;
    columnName: string;
    totalPoints: number;
    runPoints: number;
    cyclePoints: number;
    swimPoints: number;
    hikePoints: number;
    troopGamePoints: number;
  }>();

  for (const score of weeklyScores) {
    const userId = score.userId;
    const existing = userScores.get(userId);
    if (existing) {
      existing.totalPoints += score.totalPoints;
      existing.runPoints += score.runPoints;
      existing.cyclePoints += score.cyclePoints;
      existing.swimPoints += score.swimPoints;
      existing.hikePoints += score.hikePoints;
      existing.troopGamePoints += score.troopGamePoints;
    } else {
      userScores.set(userId, {
        userId,
        userName: score.user?.name || '',
        columnName: score.user?.column?.name || 'Unknown',
        totalPoints: score.totalPoints,
        runPoints: score.runPoints,
        cyclePoints: score.cyclePoints,
        swimPoints: score.swimPoints,
        hikePoints: score.hikePoints,
        troopGamePoints: score.troopGamePoints,
      });
    }
  }

  const leaderboard = Array.from(userScores.values()).sort((a, b) => b.totalPoints - a.totalPoints);
  const periodKey = weekNumber ? `week:${Number.parseInt(weekNumber, 10)}` : 'all-time';
  const rankedEntities = leaderboard.map((entry) => ({ id: entry.userId, points: entry.totalPoints }));
  const dynamics = await timed('perf.leaderboard.individual.dynamics', () => getRankingDynamics('individual', periodKey, rankedEntities), meta);
  scheduleRankingCapture('individual', periodKey, rankedEntities);

  return NextResponse.json({
    type: 'individual',
    weekNumber: weekNumber ? Number.parseInt(weekNumber, 10) : null,
    leaderboard: leaderboard.map((entry) => ({ ...entry, ...dynamics.get(entry.userId) })),
  });
}

async function getTeamLeaderboard(weekNumber: string | null) {
  const parsedWeek = weekNumber ? Number.parseInt(weekNumber, 10) : null;
  if (weekNumber && (!Number.isFinite(parsedWeek) || (parsedWeek ?? 0) < 1)) {
    return NextResponse.json({ error: 'Invalid week number' }, { status: 400 });
  }
  const meta = { route: '/api/leaderboard', type: 'team', period: weekNumber ? `week:${weekNumber}` : 'all-time' };
  const activeColumnIds = await timed('perf.leaderboard.team.active_columns', () => getActiveColumnIds(), meta);
  const [columnsResult, totalsResult] = await Promise.all([
    timed('perf.leaderboard.team.columns', () => prisma.column.findMany({
      where: { id: { in: activeColumnIds } },
      select: { id: true, name: true, _count: { select: { members: true } } },
    }), meta),
    timed('perf.leaderboard.team.totals', () => prisma.activity.groupBy({
      by: ['columnId'],
      where: { status: 'APPROVED', columnId: { in: activeColumnIds }, ...(parsedWeek ? { weekNumber: parsedWeek } : {}) },
      _sum: { points: true },
    }), meta),
  ]);
  const columns = columnsResult as TeamColumn[];
  const totals = totalsResult as TeamActivityTotal[];
  const totalsByColumn = new Map(totals.map((row) => [row.columnId, row._sum.points ?? 0]));

  const teamScores = columns.map((column) => {
    const totalPoints = totalsByColumn.get(column.id) ?? 0;
    const memberCount = column._count.members;
    const averagePoints = memberCount > 0 ? totalPoints / memberCount : 0;
    return {
      columnId: column.id,
      columnName: column.name,
      memberCount,
      totalPoints: Math.round(totalPoints * 100) / 100,
      averagePoints: Math.round(averagePoints * 100) / 100,
    };
  });

  const leaderboard = teamScores.sort((a, b) => b.totalPoints - a.totalPoints);
  const periodKey = parsedWeek ? `week:${parsedWeek}` : 'all-time';
  const rankedEntities = leaderboard.map((entry) => ({ id: entry.columnId, points: entry.totalPoints }));
  const dynamics = await timed('perf.leaderboard.team.dynamics', () => getRankingDynamics('column', periodKey, rankedEntities), meta);
  scheduleRankingCapture('column', periodKey, rankedEntities);

  return NextResponse.json({
    type: 'team',
    weekNumber: parsedWeek,
    leaderboard: leaderboard.map((entry) => ({ ...entry, ...dynamics.get(entry.columnId) })),
  });
}
