import { prisma } from '@/lib/prisma';

/** Add private feature records to manual exports as well as scheduled snapshots. */
export async function getFocusedBackupData() {
  const [activityCorrections, notificationPreferences, achievementDefinitions, userAchievements, weeklyResultRebuilds] = await Promise.all([
    prisma.$queryRawUnsafe('SELECT * FROM app_internal.activity_correction ORDER BY created_at'),
    prisma.$queryRawUnsafe('SELECT * FROM app_internal.notification_preference ORDER BY user_id'),
    prisma.$queryRawUnsafe('SELECT * FROM app_internal.achievement_definition ORDER BY sort_order'),
    prisma.$queryRawUnsafe('SELECT * FROM app_internal.user_achievement ORDER BY user_id, season_key, achievement_id'),
    prisma.$queryRawUnsafe('SELECT * FROM app_internal.weekly_result_dirty ORDER BY season_key, week_number'),
  ]);
  return { activityCorrections, notificationPreferences, achievementDefinitions, userAchievements, weeklyResultRebuilds };
}
