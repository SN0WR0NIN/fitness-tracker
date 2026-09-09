import { calculateActivityPoints, hasPositiveBaseScore, resolveEffectiveCategory, getWeekStart, getWeekNumber, roundScoreDown, type ActivityCategory, type ScoringRules } from './scoring';
import { singaporeDate } from './activity-date';

export const FRIEND_BONUS_SPORTS: readonly ActivityCategory[] = ['RUN', 'CYCLE', 'SWIM', 'WALK_OR_HIKE'];
export type DailyScoringActivity = {
  id: string; userId: string; columnId: string; category: ActivityCategory;
  distance: number; pace: number | null; completedWithFriend: boolean;
  basePointsOverride?: number | null; totalPointsOverride?: number | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED'; occurredAt: Date; createdAt: Date;
};

/** Shared by the allocator and the availability preview. Friend eligibility
 * uses the unrounded activity value so final score flooring cannot erase an
 * otherwise valid positive workout. Admin point overrides do not change friend
 * eligibility or allocation; they only change the saved score arithmetic. */
export function qualifiesForFriendBonus(activity: Pick<DailyScoringActivity, 'category' | 'distance' | 'pace'>, rules: ScoringRules): boolean {
  const category = resolveEffectiveCategory(activity.category, activity.pace ?? undefined, rules);
  if (!FRIEND_BONUS_SPORTS.includes(category)) return false;
  return hasPositiveBaseScore({ category, distance: activity.distance, pace: activity.pace ?? undefined }, rules);
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
    const calculated = calculateActivityPoints({ category, distance: activity.distance,
      pace: activity.pace ?? undefined, completedWithFriend: allowed }, rules);
    const basePoints = activity.basePointsOverride ?? calculated.basePoints;
    const totalPoints = activity.totalPointsOverride ?? roundScoreDown(basePoints + calculated.friendBonus);
    const scoring = { basePoints, friendBonus: calculated.friendBonus, totalPoints };
    return { activity, category, scoring, weekStart: getWeekStart(activity.occurredAt),
      weekNumber: getWeekNumber(activity.occurredAt, startDate) };
  });
}
