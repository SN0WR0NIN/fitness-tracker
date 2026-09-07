import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

/** Canonical v7 export: all reads share one snapshot. No passwords, tokens or
 * binary objects; media needs a separately verified private object archive. */
export async function captureOperationalBackup() {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    const challengeRows = await tx.$queryRaw<Array<Record<string, unknown>>>`SELECT * FROM public."ChallengeSetting" WHERE id='primary'`;
    if (challengeRows.length !== 1) throw new Error('Challenge settings unavailable.');
    const collections: Record<string, unknown[]> = {};
    // SQL is a fixed allowlist, never derived from an uploaded backup or user.
    const queries: Record<string, string> = {
      columns: 'SELECT * FROM public."Column" ORDER BY id',
      users: 'SELECT id,name,email,username,role,"columnId","stravaAthleteId","createdAt","updatedAt" FROM public."User" ORDER BY id',
      activities: 'SELECT id,"userId","columnId",category,distance,pace,duration,"completedWithFriend",companion,"companionUserId","companionUserIds","proofUrl",points,status,"reviewedById","reviewedAt","rejectionReason","occurredAt","weekStart","weekNumber","stravaActivityId","mapPolyline","elevationGain","createdAt","updatedAt" FROM public."Activity" ORDER BY id',
      pointsLogs: 'SELECT id,"activityId","basePoints","friendBonus","totalPoints","createdAt" FROM public."PointsLog" ORDER BY id',
      weeklyScores: 'SELECT * FROM public."WeeklyScore" ORDER BY id',
      profileSettings: 'SELECT * FROM public."UserProfileSettings" ORDER BY "userId"',
      weeklyGoals: 'SELECT * FROM public."WeeklyGoal" ORDER BY "userId","weekStart"',
      rankingSnapshots: 'SELECT * FROM public."RankingSnapshot" ORDER BY id',
      announcements: 'SELECT * FROM public."Announcement" ORDER BY id',
      audit: 'SELECT * FROM public."AdminAudit" ORDER BY id',
      duplicateReviews: 'SELECT * FROM app_internal.duplicate_review_decision ORDER BY pair_key',
      weeklyResults: 'SELECT * FROM app_internal.weekly_result ORDER BY season_key,week_number',
      notifications: 'SELECT id,user_id,kind,level,title,message,href,metadata,dedupe_key,created_at FROM app_internal.notification ORDER BY id',
      passwordResetRequests: 'SELECT id,user_id,status,request_count,requested_at,last_requested_at,issued_at,expires_at,completed_at,cancelled_at,issued_by_id,issued_by_name,created_at,updated_at FROM app_internal.password_reset_request ORDER BY id',
      activityCorrections: 'SELECT * FROM app_internal.activity_correction ORDER BY id',
      notificationPreferences: 'SELECT * FROM app_internal.notification_preference ORDER BY user_id',
      achievementDefinitions: 'SELECT * FROM app_internal.achievement_definition ORDER BY id',
      userAchievements: 'SELECT * FROM app_internal.user_achievement ORDER BY user_id,season_key,achievement_id',
      weeklyResultRebuilds: 'SELECT * FROM app_internal.weekly_result_dirty ORDER BY season_key,week_number',
    };
    for (const [key, query] of Object.entries(queries)) collections[key] = await tx.$queryRawUnsafe<unknown[]>(query);
    return {
      format: 'kg-stay-active-operational-backup', version: 7, exportedAt: new Date().toISOString(),
      excludes: ['passwords', 'Strava access tokens', 'Strava refresh tokens', 'temporary password reset secrets', 'binary storage objects'],
      challenge: challengeRows[0], ...collections,
      counts: Object.fromEntries(Object.entries(collections).map(([key, rows]) => [key, rows.length])),
      mediaCoverage: 'References only. Copy and verify storage objects separately; externally hosted proofs need their own provider recovery plan.',
    };
  }, { isolationLevel: 'RepeatableRead', timeout: 40000, maxWait: 5000 });
}
