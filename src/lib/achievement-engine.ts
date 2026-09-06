import { prisma } from '@/lib/prisma';
import type { ProfileAchievement } from '@/lib/participant-profile';

type AchievementRow = {
  name: string;
  description: string;
  category: ProfileAchievement['category'];
  tier: ProfileAchievement['tier'];
  target: number;
  unit: string;
  value: number;
};

export async function getEngineAchievements(userId: string): Promise<ProfileAchievement[]> {
  const rows: AchievementRow[] = await prisma.$queryRaw`SELECT d.name,d.description,d.category,d.tier,d.target,d.unit,
    CASE WHEN d.metric='weeklyWins' THEN (
      SELECT count(*)::float8 FROM app_internal.weekly_result r CROSS JOIN LATERAL jsonb_array_elements(r.awards) award
      WHERE r.season_key=s."startDate"::date::text AND award->>'type'='TOP_ATHLETE' AND award->>'entityType'='USER' AND award->>'entityId'=${userId}
      AND NOT EXISTS(SELECT 1 FROM app_internal.weekly_result_dirty dirty WHERE dirty.season_key=r.season_key AND dirty.week_number=r.week_number)
    ) ELSE coalesce(a.current_value,0) END AS value
    FROM app_internal.achievement_definition d CROSS JOIN "ChallengeSetting" s
    LEFT JOIN app_internal.user_achievement a ON a.user_id=${userId} AND a.achievement_id=d.id AND a.season_key=s."startDate"::date::text
    WHERE s.id='primary' ORDER BY d.sort_order`;

  return rows.map((row) => ({
    name: row.name,
    description: row.description,
    category: row.category,
    tier: row.tier,
    unlocked: row.value >= row.target,
    progress: Math.max(0, Math.min(row.value / row.target, 1)),
    progressLabel: `${row.unit === 'pts' ? Math.min(row.value, row.target).toFixed(1) : Math.min(row.value, row.target)} / ${row.target} ${row.unit}`,
  }));
}
