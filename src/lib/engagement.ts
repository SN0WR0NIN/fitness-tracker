import { getWeekStart } from '@/lib/scoring';

type WeekScore = {
  weekStart: Date;
  totalPoints: number;
};

export const DEFAULT_WEEKLY_GOAL = 25;

export function getSuggestedWeeklyGoal(weeks: WeekScore[]): number {
  const completedWeeks = weeks
    .filter((week) => week.weekStart.getTime() < getWeekStart(new Date()).getTime() && week.totalPoints > 0)
    .slice(-3);

  if (!completedWeeks.length) return DEFAULT_WEEKLY_GOAL;
  const average = completedWeeks.reduce((sum, week) => sum + week.totalPoints, 0) / completedWeeks.length;
  return Math.max(DEFAULT_WEEKLY_GOAL, Math.ceil(average / 5) * 5);
}

export function getCurrentWeekPoints(weeks: WeekScore[], now = new Date()): number {
  const currentWeekStart = getWeekStart(now).getTime();
  return weeks
    .filter((week) => getWeekStart(week.weekStart).getTime() === currentWeekStart)
    .reduce((sum, week) => sum + week.totalPoints, 0);
}

export function getWeeklyStreak(weeks: WeekScore[], now = new Date()): number {
  const activeWeeks = new Set(
    weeks
      .filter((week) => week.totalPoints > 0)
      .map((week) => getWeekStart(week.weekStart).getTime())
  );
  const millisecondsPerWeek = 7 * 24 * 60 * 60 * 1000;
  let cursor = getWeekStart(now).getTime();

  // A streak remains alive during a new week before the athlete logs again.
  if (!activeWeeks.has(cursor)) cursor -= millisecondsPerWeek;

  let streak = 0;
  while (activeWeeks.has(cursor)) {
    streak += 1;
    cursor -= millisecondsPerWeek;
  }
  return streak;
}
