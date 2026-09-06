const { test, expect } = require('@playwright/test');
const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('node:crypto');

test('goal streaks use completed consecutive weeks and corrected awards require rebuilding', async () => {
  const url = new URL(process.env.DATABASE_URL || 'http://invalid');
  if (process.env.CI !== 'true' || process.env.E2E_TEST_MODE !== '1' || !['localhost','127.0.0.1'].includes(url.hostname) || url.pathname !== '/fitness_tracker_e2e') throw new Error('Disposable CI database required');
  const db = new PrismaClient();
  try {
    const privacy = await db.$queryRaw`SELECT c.relname,c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='app_internal' AND c.relname IN ('activity_correction','notification_preference','weekly_result_dirty','achievement_definition','user_achievement')`;
    expect(privacy).toHaveLength(5);
    expect(privacy.every((r) => r.relrowsecurity)).toBe(true);
    const triggers = await db.$queryRaw`SELECT tgname,tgdeferrable,tginitdeferred FROM pg_trigger
      WHERE (tgrelid='public."Activity"'::regclass AND tgname='zz_focused_achievements')
      OR (tgrelid='public."WeeklyGoal"'::regclass AND tgname='zz_focused_goal_achievements')
      OR (tgrelid='app_internal.weekly_result'::regclass AND tgname='zz_focused_award_achievements')`;
    expect(triggers).toHaveLength(3);
    expect(triggers.every((r) => r.tgdeferrable && r.tginitdeferred)).toBe(true);
    // All historical fixtures and the temporary season roll back together.
    await expect(db.$transaction(async (tx) => {
      const userId = `focused_metrics_${randomUUID()}`;
      await tx.$executeRaw`UPDATE "ChallengeSetting" SET "startDate"='2026-08-01'::timestamp,"weeklyGoal"=25 WHERE id='primary'`;
      await tx.user.create({ data: { id: userId, name: 'Synthetic Metrics Member', email: `${userId}@example.test`, password: 'invalid-hash-no-login', role: 'MEMBER', columnId: 'e2e_column' } });
      for (const [index, date] of ['2026-08-09', '2026-08-16', '2026-08-23'].entries()) {
        await tx.activity.create({ data: { userId, columnId: 'e2e_column', category: 'RUN', distance: 20, pace: 6, points: 30, status: 'APPROVED', reviewedById: 'e2e_admin', reviewedAt: new Date(), occurredAt: new Date(`${date}T04:00:00Z`), weekStart: new Date(`${date}T00:00:00Z`), weekNumber: index + 3 } });
        await tx.$executeRaw`INSERT INTO "WeeklyGoal" ("userId","weekStart",target) VALUES (${userId},${new Date(`${date}T00:00:00Z`)},25)`;
      }
      const badge = async (id) => {
        // This rollback-only metrics fixture deliberately checks several final
        // states in one transaction. Flush at those explicit assertion boundaries,
        // then restore the production default. HTTP tests verify actual commits.
        await tx.$executeRaw`SET CONSTRAINTS public.zz_focused_achievements, public.zz_focused_goal_achievements, app_internal.zz_focused_award_achievements IMMEDIATE`;
        const rows = await tx.$queryRaw`SELECT unlocked,current_value FROM app_internal.user_achievement WHERE user_id=${userId} AND season_key='2026-08-01' AND achievement_id=${id}`;
        await tx.$executeRaw`SET CONSTRAINTS public.zz_focused_achievements, public.zz_focused_goal_achievements, app_internal.zz_focused_award_achievements DEFERRED`;
        return rows[0];
      };
      expect(await badge('goal-streak-3')).toMatchObject({ unlocked: true, current_value: 3 });
      expect((await badge('goal-streak-5')).unlocked).toBe(false);
      await tx.$executeRaw`UPDATE "WeeklyGoal" SET target=100 WHERE "userId"=${userId} AND "weekStart"='2026-08-16'::timestamp`;
      expect(await badge('goal-streak-3')).toMatchObject({ unlocked: false, current_value: 1 });
      await tx.$executeRaw`UPDATE "WeeklyGoal" SET target=25 WHERE "userId"=${userId} AND "weekStart"='2026-08-16'::timestamp`;
      expect((await badge('goal-streak-3')).unlocked).toBe(true);
      const awards = JSON.stringify([{ type: 'TOP_ATHLETE', entityType: 'USER', entityId: userId }]);
      await tx.$executeRaw`INSERT INTO app_internal.weekly_result(season_key,week_number,challenge_name,week_start_key,display_start_date,display_end_date,awards) VALUES ('2026-08-01',3,'Synthetic metrics','2026-08-09','2026-08-09','2026-08-15',${awards}::jsonb)`;
      expect((await badge('weekly-champion')).unlocked).toBe(true);
      await tx.$executeRaw`INSERT INTO app_internal.weekly_result_dirty(season_key,week_number,reason) VALUES ('2026-08-01',3,'Synthetic late correction')`;
      await tx.$executeRaw`SELECT app_internal.refresh_user_achievements(${userId},true)`;
      expect((await badge('weekly-champion')).unlocked).toBe(false);
      // The same result-write path as a rebuild clears the dirty marker first.
      await tx.$executeRaw`UPDATE app_internal.weekly_result SET updated_at=now() WHERE season_key='2026-08-01' AND week_number=3`;
      expect((await badge('weekly-champion')).unlocked).toBe(true);
      expect(await tx.$queryRaw`SELECT * FROM app_internal.weekly_result_dirty WHERE season_key='2026-08-01'`).toHaveLength(0);
      throw new Error('ROLLBACK_FOCUSED_METRICS');
    }, { timeout: 15000 })).rejects.toThrow('ROLLBACK_FOCUSED_METRICS');
  } finally { await db.$disconnect(); }
});
