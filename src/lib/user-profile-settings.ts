import { prisma } from '@/lib/prisma';

export type UserProfileSettings = {
  userId: string;
  weeklyGoal: number;
};

let schemaReady: Promise<void> | null = null;

export function ensureUserProfileSettingsSchema() {
  if (!schemaReady) {
    schemaReady = prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "UserProfileSettings" (
      "userId" TEXT PRIMARY KEY REFERENCES "User"("id") ON DELETE CASCADE,
      "weeklyGoal" DOUBLE PRECISION NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`).then(() => undefined).catch((error: unknown) => {
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

export async function updateUserProfileSettings(userId: string, name: string, weeklyGoal: number) {
  await ensureUserProfileSettingsSchema();
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
  ]);
}
