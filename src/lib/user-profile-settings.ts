import { prisma } from '@/lib/prisma';
import { getWeekStart } from '@/lib/scoring';

export type UserProfileSettings = {
  userId: string;
  weeklyGoal: number;
};

export type WeeklyGoalRecord = {
  weekStart: Date;
  target: number;
};

let schemaReady: Promise<void> | null = null;

export function ensureUserProfileSettingsSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "UserProfileSettings" (
        "userId" TEXT PRIMARY KEY REFERENCES "User"("id") ON DELETE CASCADE,
        "weeklyGoal" DOUBLE PRECISION NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`);
      await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "WeeklyGoal" (
        "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
        "weekStart" TIMESTAMP(3) NOT NULL,
        "target" DOUBLE PRECISION NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY ("userId", "weekStart")
      )`);
    })().catch((error: unknown) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

export async function getUserProfileSettings(userId: string) {
  await ensureUserProfileSettingsSchema();
  const rows = await prisma.$queryRawUnsafe(
    'SELECT "userId", "weeklyGoal" FROM "UserProfileSettings" WHERE "userId"=$1 LIMIT 1',
    userId,
  ) as UserProfileSettings[];
  return rows[0] ?? null;
}

export async function getWeeklyGoalRecords(userId: string) {
  await ensureUserProfileSettingsSchema();
  return prisma.$queryRawUnsafe(
    'SELECT "weekStart", "target" FROM "WeeklyGoal" WHERE "userId"=$1 ORDER BY "weekStart" DESC LIMIT 12',
    userId,
  ) as Promise<WeeklyGoalRecord[]>;
}

export async function captureWeeklyGoal(userId: string, weekStart: Date, target: number) {
  await ensureUserProfileSettingsSchema();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "WeeklyGoal" ("userId", "weekStart", "target", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT ("userId", "weekStart") DO UPDATE
     SET "target"=EXCLUDED."target", "updatedAt"=CURRENT_TIMESTAMP`,
    userId,
    weekStart,
    target,
  );
}

export async function updateUserProfileSettings(userId: string, name: string, weeklyGoal: number) {
  await ensureUserProfileSettingsSchema();
  const weekStart = getWeekStart(new Date());
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { name } }),
    prisma.$executeRawUnsafe(
      `INSERT INTO "UserProfileSettings" ("userId", "weeklyGoal", "createdAt", "updatedAt")
       VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT ("userId") DO UPDATE
       SET "weeklyGoal"=EXCLUDED."weeklyGoal", "updatedAt"=CURRENT_TIMESTAMP`,
      userId,
      weeklyGoal,
    ),
    prisma.$executeRawUnsafe(
      `INSERT INTO "WeeklyGoal" ("userId", "weekStart", "target", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT ("userId", "weekStart") DO UPDATE
       SET "target"=EXCLUDED."target", "updatedAt"=CURRENT_TIMESTAMP`,
      userId,
      weekStart,
      weeklyGoal,
    ),
  ]);
}
