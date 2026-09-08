import { calculateActivityPoints, resolveEffectiveCategory, getWeekStart, getWeekNumber, type ActivityCategory, type ScoringRules } from './scoring';
import { singaporeDate } from './activity-date';

export const FRIEND_BONUS_SPORTS: readonly ActivityCategory[] = ['RUN', 'CYCLE', 'SWIM', 'WALK_OR_HIKE'];
export type DailyScoringActivity = {
  id: string; userId: string; columnId: string; category: ActivityCategory;
  distance: number; pace: number | null; completedWithFriend: boolean;
  status: 'PENDING' | 'APPROVED' | 'REJECTED'; occurredAt: Date; createdAt: Date;
};

/** Shared by the allocator and the availability preview. basePoints is a
 * two-decimal display value and can round a small positive workout to zero.
 * Solo totalPoints uses the official round-down half-point rule. */
export function qualifiesForFriendBonus(activity: Pick<DailyScoringActivity, 'category' | 'distance' | 'pace'>, rules: ScoringRules): boolean {
  const category = resolveEffectiveCategory(activity.category, activity.pace ?? undefined, rules);
  if (!FRIEND_BONUS_SPORTS.includes(category)) return false;
  return calculateActivityPoints({ category, distance: activity.distance, pace: activity.pace ?? undefined }, rules).totalPoints > 0;
}

/** Approved workouts claim first; pending amounts are estimates only. Within
 * each status, earliest workout time, then submission time/id wins. Selection
 * of more people, different friends, or more submissions never expands a cap. */
export function planDailyActivityScores<T extends DailyScoringActivity>(activities: readonly T[], rules: ScoringRules, startDate: Date) {
  const claimed = new Set<string>();
  const priority = { APPROVED: 0, PENDING: 1, REJECTED: 2 };
  return [...activities].sort((a, b) => priority[a.status] - priority[b.status]
    || a.occurredAt.getTime() - b.occurredAt.getTime()
    || a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id)).map(activity => {
    const category = resolveEffectiveCategory(activity.category, activity.pace ?? undefined, rules);
    const key = JSON.stringify([activity.userId, singaporeDate(activity.occurredAt), category]);
    const eligible = activity.completedWithFriend && activity.status !== 'REJECTED'
      && qualifiesForFriendBonus(activity, rules);
    const allowed = eligible && !claimed.has(key);
    if (allowed) claimed.add(key);
    const scoring = calculateActivityPoints({ category, distance: activity.distance,
      pace: activity.pace ?? undefined, completedWithFriend: allowed }, rules);
    return { activity, category, scoring, weekStart: getWeekStart(activity.occurredAt),
      weekNumber: getWeekNumber(activity.occurredAt, startDate) };
  });
}
