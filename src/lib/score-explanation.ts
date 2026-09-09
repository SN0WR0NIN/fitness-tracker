export type ScoreBreakdown = { basePoints: number; friendBonus: number; totalPoints: number };
export type ExplainedActivity = {
  category: string; status: 'APPROVED' | 'PENDING' | 'REJECTED'; points: number;
  completedWithFriend: boolean; pointsLog?: ScoreBreakdown | null;
  basePointsOverride?: number | null; totalPointsOverride?: number | null;
};

/** Explain stored ledger values, never re-score an activity in the browser. */
export function explainScore(activity: ExplainedActivity) {
  const log = activity.pointsLog;
  const status = activity.status === 'APPROVED' ? 'Included in standings'
    : activity.status === 'PENDING' ? 'Pending estimate — not included in standings'
    : 'Rejected — not included in standings';
  if (!log || ![log.basePoints, log.friendBonus, log.totalPoints].every(Number.isFinite) || log.totalPoints !== activity.points) {
    return { status, message: 'Detailed breakdown unavailable. Refresh to load the latest saved scores.', breakdown: null, overridden: false };
  }
  const overridden = activity.basePointsOverride !== null && activity.basePointsOverride !== undefined
    || activity.totalPointsOverride !== null && activity.totalPointsOverride !== undefined;
  if (overridden) {
    return { status, message: 'Administrator score override applied. Friend-bonus allocation remains automatic.', breakdown: log, overridden: true };
  }
  const message = activity.status === 'REJECTED' ? 'No friend bonus is awarded to a rejected activity.'
    : activity.category === 'TROOP_GAMES' ? 'Troop Games uses fixed session points; no friend bonus.'
    : log.friendBonus > 0 ? `+${log.friendBonus} friend bonus ${activity.status === 'PENDING' ? 'estimated' : 'applied'} for this sport and Singapore date.`
    : !activity.completedWithFriend ? 'Solo activity — no friend bonus.'
    : activity.points <= 0 ? 'This activity does not meet the qualifying scoring minimum; no friend bonus.'
    : 'No friend bonus allocated to this entry. The allowance is limited to once per sport per Singapore date.';
  return { status, message, breakdown: log, overridden: false };
}
