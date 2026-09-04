import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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
  members: Array<{ activities: Array<{ points: number }> }>;
};

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

  return NextResponse.json({
    type: 'individual',
    weekNumber: weekNumber ? parseInt(weekNumber) : null,
    leaderboard,
  });
}

async function getTeamLeaderboard(weekNumber: string | null) {
  // Get all columns with their members
  const columns = await prisma.column.findMany({
    include: {
      members: {
        include: {
          activities: {
            where: {
              status: 'APPROVED',
              ...(weekNumber ? { weekNumber: parseInt(weekNumber) } : {}),
            },
          },
        },
      },
    },
  }) as TeamColumn[];

  // Calculate team scores
  const teamScores = columns.map((column) => {
    const totalPoints = column.members.reduce(
      (sum, member) =>
        sum +
        member.activities.reduce((actSum, activity) => actSum + activity.points, 0),
      0
    );

    const averagePoints =
      column.members.length > 0 ? totalPoints / column.members.length : 0;

    return {
      columnId: column.id,
      columnName: column.name,
      memberCount: column.members.length,
      totalPoints: Math.round(totalPoints * 100) / 100,
      averagePoints: Math.round(averagePoints * 100) / 100,
    };
  });

  return NextResponse.json({
    type: 'team',
    weekNumber: weekNumber ? parseInt(weekNumber) : null,
    leaderboard: teamScores.sort((a, b) => b.totalPoints - a.totalPoints),
  });
}
