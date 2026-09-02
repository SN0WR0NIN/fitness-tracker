/**
 * One-off migration: recompute all Activity.points/category using the new
 * official scoring formula, and rebuild WeeklyScore from scratch based on
 * currently-APPROVED activities only. Safe to re-run (idempotent).
 *
 * Mirrors the logic in src/lib/scoring.ts (duplicated here in plain JS since
 * this is a standalone migration script, not part of the running app).
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const RUN_SLOW_PACE_THRESHOLD = 9;
const WALK_MIN_DISTANCE_KM = 5;

function resolveEffectiveCategory(category, pace) {
  if (category === 'RUN' && pace !== null && pace !== undefined && pace > RUN_SLOW_PACE_THRESHOLD) {
    return 'WALK_OR_HIKE';
  }
  return category;
}

function runPaceBonusPerKm(pace) {
  if (pace < 5) return 1.5;
  if (pace < 6) return 1.0;
  return 0.5;
}

function calculatePoints(category, distance, pace, completedWithFriend) {
  let basePoints = 0;
  switch (category) {
    case 'RUN':
      if (distance) {
        const bonus = pace !== null && pace !== undefined ? runPaceBonusPerKm(pace) : 0;
        basePoints = distance * (1 + bonus);
      }
      break;
    case 'CYCLE':
      if (distance) basePoints = distance / 3;
      break;
    case 'SWIM':
      if (distance) basePoints = distance / 100;
      break;
    case 'WALK_OR_HIKE':
      if (distance && distance >= WALK_MIN_DISTANCE_KM) basePoints = distance;
      break;
    case 'TROOP_GAMES':
      basePoints = 5;
      break;
  }
  const friendBonus = completedWithFriend ? 3 : 0;
  return Math.floor(basePoints + friendBonus);
}

function categoryScoreField(category) {
  return {
    RUN: 'runPoints',
    CYCLE: 'cyclePoints',
    SWIM: 'swimPoints',
    WALK_OR_HIKE: 'hikePoints',
    TROOP_GAMES: 'troopGamePoints',
  }[category] || 'totalPoints';
}

async function main() {
  const activities = await prisma.activity.findMany();
  console.log(`Recomputing ${activities.length} activities...`);

  let recategorized = 0;
  for (const activity of activities) {
    const effectiveCategory = resolveEffectiveCategory(activity.category, activity.pace);
    const newPoints = calculatePoints(
      effectiveCategory,
      activity.distance,
      activity.pace,
      activity.completedWithFriend
    );

    if (effectiveCategory !== activity.category) recategorized++;

    await prisma.activity.update({
      where: { id: activity.id },
      data: { category: effectiveCategory, points: newPoints },
    });
  }
  console.log(`Done. ${recategorized} activities recategorized from RUN to WALK_OR_HIKE.`);

  // Rebuild WeeklyScore from scratch based on currently-APPROVED activities
  console.log('Rebuilding WeeklyScore from approved activities...');
  await prisma.weeklyScore.deleteMany({});

  const approved = await prisma.activity.findMany({ where: { status: 'APPROVED' } });
  const buckets = new Map();

  for (const activity of approved) {
    const key = `${activity.userId}|${activity.weekStart.toISOString()}`;
    if (!buckets.has(key)) {
      buckets.set(key, {
        userId: activity.userId,
        columnId: activity.columnId,
        weekStart: activity.weekStart,
        weekNumber: activity.weekNumber,
        totalPoints: 0,
        runPoints: 0,
        cyclePoints: 0,
        swimPoints: 0,
        hikePoints: 0,
        troopGamePoints: 0,
      });
    }
    const bucket = buckets.get(key);
    bucket.totalPoints += activity.points;
    bucket[categoryScoreField(activity.category)] += activity.points;
  }

  for (const bucket of buckets.values()) {
    await prisma.weeklyScore.create({ data: bucket });
  }
  console.log(`Rebuilt ${buckets.size} weekly score rows.`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
