#!/usr/bin/env node
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const password = process.env.E2E_PASSWORD || 'E2E-only-Password-123!';

async function main() {
  await prisma.$executeRawUnsafe('ALTER TABLE "Column" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true');

  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "ChallengeSetting" (
    "id" TEXT PRIMARY KEY,
    "challengeName" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "weeklyGoal" DOUBLE PRECISION NOT NULL DEFAULT 25,
    "scoringRules" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "maintenanceMode" BOOLEAN NOT NULL DEFAULT false,
    "maintenanceMessage" TEXT NOT NULL DEFAULT 'New activity submissions are temporarily paused.'
  )`);
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "Announcement" (
    "id" TEXT PRIMARY KEY,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "AdminAudit" (
    "id" TEXT PRIMARY KEY,
    "actorId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "RankingSnapshot" (
    "id" TEXT PRIMARY KEY,
    "scope" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "points" DOUBLE PRECISION NOT NULL,
    "snapshotDate" DATE NOT NULL DEFAULT CURRENT_DATE,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE ("scope", "periodKey", "entityId", "snapshotDate")
  )`);
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "UserProfileSettings" (
    "userId" TEXT PRIMARY KEY REFERENCES "User"("id") ON DELETE CASCADE,
    "weeklyGoal" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bio" TEXT NOT NULL DEFAULT '',
    "profilePhotoUrl" TEXT
  )`);
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "WeeklyGoal" (
    "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "target" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("userId", "weekStart")
  )`);

  const hash = await bcrypt.hash(password, 10);
  await prisma.column.upsert({
    where: { name: 'E2E Column' },
    update: {},
    create: { id: 'e2e_column', name: 'E2E Column' },
  });
  await prisma.$executeRawUnsafe('UPDATE "Column" SET "isActive"=true WHERE "id"=$1', 'e2e_column');

  await prisma.user.upsert({
    where: { email: 'member-e2e@example.test' },
    update: { password: hash, role: 'MEMBER', columnId: 'e2e_column', mustChangePassword: false },
    create: {
      id: 'e2e_member', name: 'E2E Member', email: 'member-e2e@example.test', username: 'e2e-member',
      password: hash, role: 'MEMBER', columnId: 'e2e_column', mustChangePassword: false,
    },
  });
  await prisma.user.upsert({
    where: { email: 'admin-e2e@example.test' },
    update: { password: hash, role: 'ADMIN', columnId: 'e2e_column', mustChangePassword: false },
    create: {
      id: 'e2e_admin', name: 'E2E Admin', email: 'admin-e2e@example.test', username: 'e2e-admin',
      password: hash, role: 'ADMIN', columnId: 'e2e_column', mustChangePassword: false,
    },
  });

  await prisma.$executeRawUnsafe(`INSERT INTO "ChallengeSetting"
    ("id","challengeName","startDate","endDate","weeklyGoal","scoringRules","maintenanceMode","maintenanceMessage")
    VALUES ($1,$2,$3,$4,$5,$6::jsonb,false,$7)
    ON CONFLICT ("id") DO UPDATE SET
      "challengeName"=EXCLUDED."challengeName", "startDate"=EXCLUDED."startDate", "endDate"=EXCLUDED."endDate",
      "weeklyGoal"=EXCLUDED."weeklyGoal", "scoringRules"=EXCLUDED."scoringRules", "maintenanceMode"=false`,
    'primary', 'E2E Stay Active', new Date('2026-09-01T00:00:00Z'), new Date('2026-12-31T23:59:59Z'), 25, '{}', 'E2E maintenance');

  console.log('E2E database bootstrapped.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
