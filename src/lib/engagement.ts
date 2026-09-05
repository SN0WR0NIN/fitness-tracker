import { getWeekStart, getWeekNumber } from '@/lib/scoring';

type WeekScore = {
  weekNumber?: number;
  weekStart: Date;
  totalPoints: number;
};

type GoalRecord = { weekStart: Date; target: number };

export type WeeklyGoalIntelligence = {
  status: 'achieved' | 'on-track' | 'at-risk';
  daysRemaining: number;
  hoursRemaining: number;
  remainingPoints: number;
  completionStreak: number;
  milestone: 0 | 50 | 80 | 100;
  history: Array<{ weekNumber: number; dateRange: string; points: number; target: number; achieved: boolean; current: boolean }>;
  badges: Array<{ name: string; description: string; unlocked: boolean; progress: number }>;
};

export const DEFAULT_WEEKLY_GOAL = 25;

export function getSuggestedWeeklyGoal(weeks: WeekScore[], minimumGoal = DEFAULT_WEEKLY_GOAL): number {
  const completedWeeks = weeks
    .filter((week) => week.weekStart.getTime() < getWeekStart(new Date()).getTime() && week.totalPoints > 0)
    .slice(-3);

  if (!completedWeeks.length) return minimumGoal;
  const average = completedWeeks.reduce((sum, week) => sum + week.totalPoints, 0) / completedWeeks.length;
  return Math.max(minimumGoal, Math.ceil(average / 5) * 5);
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

export function getWeeklyGoalIntelligence(weeks: WeekScore[], goalRecords: GoalRecord[], weeklyGoal: number, now = new Date(), challengeStart = new Date('2026-09-01T00:00:00Z')): WeeklyGoalIntelligence {
  const weekStart = getWeekStart(now);
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const dayMs = 24 * 60 * 60 * 1000;
  const weekEnd = new Date(weekStart.getTime() + weekMs - 8 * 3600000);
  const remainingMs = Math.max(0, weekEnd.getTime() - now.getTime());
  const targetByWeek = new Map(goalRecords.map((record) => [getWeekStart(record.weekStart).getTime(), record.target]));
  const scoreByWeek = new Map<number, { points: number; weekNumber: number }>();

  for (const week of weeks) {
    const key = getWeekStart(week.weekStart).getTime();
    const existing = scoreByWeek.get(key);
    scoreByWeek.set(key, {
      points: (existing?.points ?? 0) + week.totalPoints,
      weekNumber: week.weekNumber ?? existing?.weekNumber ?? 1,
    });
  }

  const currentKey = weekStart.getTime();
  const currentWeekNumber = getWeekNumber(now, challengeStart);
  const currentPoints = scoreByWeek.get(currentKey)?.points ?? 0;
  const progress = weeklyGoal > 0 ? currentPoints / weeklyGoal : 0;
  const elapsed = Math.min(1, Math.max(0, (now.getTime() - Math.max(currentKey - 8 * 3600000, challengeStart.getTime() - 8 * 3600000)) / (weekEnd.getTime() - Math.max(currentKey - 8 * 3600000, challengeStart.getTime() - 8 * 3600000))));
  const status = progress >= 1 ? 'achieved' : progress >= elapsed * 0.9 ? 'on-track' : 'at-risk';
  const milestone = progress >= 1 ? 100 : progress >= 0.8 ? 80 : progress >= 0.5 ? 50 : 0;
  const count = Math.min(7, Math.max(0, currentWeekNumber));
  const history = Array.from({ length: count }, (_, offset) => {
    const key = currentKey - (count - 1 - offset) * weekMs;
    const labelDate = (value: number) => new Date(value).toLocaleDateString('en-SG', { timeZone: 'UTC', day: 'numeric', month: 'short' });
    const score = scoreByWeek.get(key);
    const target = targetByWeek.get(key) ?? weeklyGoal;
    return {
      weekNumber: currentWeekNumber - (count - 1 - offset),
      dateRange: `${labelDate(Math.max(key, challengeStart.getTime()))} – ${labelDate(key + 6 * dayMs)}`,
      points: score?.points ?? 0,
      target,
      achieved: (score?.points ?? 0) >= target,
      current: key === currentKey,
    };
  });

  let completionStreak = 0;
  let index = history.length - 1;
  if (history[index] && !history[index].achieved) index -= 1;
  while (index >= 0 && history[index].achieved) {
    completionStreak += 1;
    index -= 1;
  }

  return {
    status,
    daysRemaining: Math.ceil(remainingMs / dayMs),
    hoursRemaining: Math.ceil(remainingMs / (60 * 60 * 1000)),
    remainingPoints: Math.max(0, weeklyGoal - currentPoints),
    completionStreak,
    milestone,
    history,
    badges: [
      { name: 'Goal Getter', description: 'Complete your weekly target', unlocked: history.some((week) => week.achieved), progress: Math.min(progress, 1) },
      { name: 'Target Streak', description: 'Complete your target 3 weeks running', unlocked: completionStreak >= 3, progress: Math.min(completionStreak / 3, 1) },
      { name: 'Unstoppable', description: 'Complete your target 6 weeks running', unlocked: completionStreak >= 6, progress: Math.min(completionStreak / 6, 1) },
    ],
  };
}
