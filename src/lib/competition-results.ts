import { prisma } from '@/lib/prisma';

export type WeeklyAward = {
  type: string;
  label: string;
  emoji: string;
  entityType: 'USER' | 'COLUMN';
  entityId: string;
  entityName: string;
  value: number;
  displayValue: string;
};

export type AthleteStanding = {
  userId: string;
  name: string;
  rank: number;
  points: number;
  activityCount: number;
  runPoints: number;
  cyclePoints: number;
  swimPoints: number;
  hikePoints: number;
  troopGamePoints: number;
  goalTarget: number;
  goalCompletionPct: number;
};

export type ColumnStanding = {
  columnId: string;
  name: string;
  rank: number;
  points: number;
  activityCount: number;
  activeAthletes: number;
};

export type WeeklyCompetitionResult = {
  seasonKey: string;
  weekNumber: number;
  challengeName: string;
  weekStartKey: Date;
  displayStartDate: Date;
  displayEndDate: Date;
  totalPoints: number;
  activityCount: number;
  activeAthletes: number;
  awards: WeeklyAward[];
  athleteStandings: AthleteStanding[];
  columnStandings: ColumnStanding[];
  generatedAt: Date;
  updatedAt: Date;
};

export async function getWeeklyCompetitionResults(limit = 30): Promise<WeeklyCompetitionResult[]> {
  return prisma.$queryRawUnsafe(`
    SELECT
      season_key AS "seasonKey",
      week_number AS "weekNumber",
      challenge_name AS "challengeName",
      week_start_key AS "weekStartKey",
      display_start_date AS "displayStartDate",
      display_end_date AS "displayEndDate",
      total_points AS "totalPoints",
      activity_count AS "activityCount",
      active_athletes AS "activeAthletes",
      awards,
      athlete_standings AS "athleteStandings",
      column_standings AS "columnStandings",
      generated_at AS "generatedAt",
      updated_at AS "updatedAt"
    FROM app_internal.weekly_result
    ORDER BY display_start_date DESC
    LIMIT $1
  `, limit) as Promise<WeeklyCompetitionResult[]>;
}

export async function getWeeklyCompetitionResult(weekNumber: number): Promise<WeeklyCompetitionResult | null> {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT
      season_key AS "seasonKey", week_number AS "weekNumber", challenge_name AS "challengeName",
      week_start_key AS "weekStartKey", display_start_date AS "displayStartDate", display_end_date AS "displayEndDate",
      total_points AS "totalPoints", activity_count AS "activityCount", active_athletes AS "activeAthletes",
      awards, athlete_standings AS "athleteStandings", column_standings AS "columnStandings",
      generated_at AS "generatedAt", updated_at AS "updatedAt"
    FROM app_internal.weekly_result
    WHERE week_number=$1
    ORDER BY display_start_date DESC
    LIMIT 1
  `, weekNumber) as WeeklyCompetitionResult[];
  return rows[0] ?? null;
}

export async function rebuildWeeklyCompetitionResult(weekNumber: number) {
  const rows = await prisma.$queryRawUnsafe(
    'SELECT app_internal.generate_weekly_result($1,true) AS "resultKey"',
    weekNumber,
  ) as Array<{ resultKey: string }>;
  return rows[0]?.resultKey ?? null;
}

export async function getLatestCompletedWeekNumber(): Promise<number> {
  const rows = await prisma.$queryRawUnsafe(`
    WITH challenge AS (
      SELECT "startDate"::date AS start_date, "endDate"::date AS end_date
      FROM "ChallengeSetting" WHERE id='primary'
    ), calc AS (
      SELECT
        start_date,
        end_date,
        start_date - extract(dow from start_date)::int AS first_sunday,
        end_date - extract(dow from end_date)::int AS last_sunday,
        (now() AT TIME ZONE 'Asia/Singapore')::date AS today_sg
      FROM challenge
    )
    SELECT greatest(0, least(
      (((today_sg - extract(dow from today_sg)::int) - first_sunday) / 7),
      ((last_sunday - first_sunday) / 7) + 1
    ))::int AS "weekNumber"
    FROM calc
  `) as Array<{ weekNumber: number }>;
  return rows[0]?.weekNumber ?? 0;
}
