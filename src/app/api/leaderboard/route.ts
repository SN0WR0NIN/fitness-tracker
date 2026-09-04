import { after, NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getActiveColumnIds } from '@/lib/admin-control';
import { captureRankingSnapshot, getRankingDynamics } from '@/lib/ranking-dynamics';

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
    email: string;
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
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'individual'; // individual or team
    const weekNumber = searchParams.get('weekNumber');

    if (type === 'individual') {
      return getIndividualLeaderboard(weekNumber);
    } else if (type === 'team') {
      return getTeamLeaderboard(weekNumber);
    }

    return NextResponse.json(
      { error: 'Invalid leaderboard type' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return NextResponse.json(
      { error: 'Failed to fetch leaderboard' },
      { status: 500 }
    );
  }
}

async function getIndividualLeaderboard(weekNumber: string | null) {
  // Build the where clause
  const where: { weekNumber?: number } = {};
  if (weekNumber) {
    where.weekNumber = parseInt(weekNumber);
  }

  // If no week specified, get all-time scores
  const weeklyScores = await prisma.weeklyScore.findMany({
    where,
    include: {
      user: {
        select: { id: true, name: true, email: true, column: true },
      },
    },
    orderBy: { totalPoints: 'desc' },
  }) as WeeklyScoreRow[];

  // Group every result by user. Historical weekStart values could include a
  // time of day, leaving multiple WeeklyScore rows for one athlete in a week.
  const userScores = new Map<
    string,
    {
      userId: string;
      userName: string;
      userEmail: string;
      columnName: string;
      totalPoints: number;
      runPoints: number;
      cyclePoints: number;
      swimPoints: number;
      hikePoints: number;
      troopGamePoints: number;
    }
  >();

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
        userEmail: score.user?.email || '',
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

  const leaderboard = Array.from(userScores.values()).sort(
    (a, b) => b.totalPoints - a.totalPoints
  );
  const periodKey = weekNumber ? `week:${parseInt(weekNumber)}` : 'all-time';
  const rankedEntities = leaderboard.map((entry) => ({ id: entry.userId, points: entry.totalPoints }));
  const dynamics = await getRankingDynamics('individual', periodKey, rankedEntities);
  scheduleRankingCapture('individual', periodKey, rankedEntities);

  return NextResponse.json({
    type: 'individual',
    weekNumber: weekNumber ? parseInt(weekNumber) : null,
    leaderboard: leaderboard.map((entry) => ({ ...entry, ...dynamics.get(entry.userId) })),
  });
}

async function getTeamLeaderboard(weekNumber: string | null) {
  const activeColumnIds = await getActiveColumnIds();
  const [columnsResult, totalsResult] = await Promise.all([
    prisma.column.findMany({
      where: { id: { in: activeColumnIds } },
      select: { id: true, name: true, _count: { select: { members: true } } },
    }),
    prisma.activity.groupBy({
      by: ['columnId'],
      where: { status: 'APPROVED', columnId: { in: activeColumnIds }, ...(weekNumber ? { weekNumber: parseInt(weekNumber) } : {}) },
      _sum: { points: true },
    }),
  ]);
  const columns = columnsResult as TeamColumn[];
  const totals = totalsResult as TeamActivityTotal[];
  const totalsByColumn = new Map(totals.map((row) => [row.columnId, row._sum.points ?? 0]));

  // Calculate team scores
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
  const periodKey = weekNumber ? `week:${parseInt(weekNumber)}` : 'all-time';
  const rankedEntities = leaderboard.map((entry) => ({ id: entry.columnId, points: entry.totalPoints }));
  const dynamics = await getRankingDynamics('column', periodKey, rankedEntities);
  scheduleRankingCapture('column', periodKey, rankedEntities);

  return NextResponse.json({
    type: 'team',
    weekNumber: weekNumber ? parseInt(weekNumber) : null,
    leaderboard: leaderboard.map((entry) => ({ ...entry, ...dynamics.get(entry.columnId) })),
  });
}
