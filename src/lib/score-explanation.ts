export type ScoreBreakdown = { basePoints: number; friendBonus: number; totalPoints: number };
export type ScoreDisplayBreakdown = ScoreBreakdown & { distancePoints: number; pacePoints: number };
export type ExplainedActivity = {
  category: string; status: 'APPROVED' | 'PENDING' | 'REJECTED'; points: number;
  distance?: number | null; pace?: number | null;
  completedWithFriend: boolean; pointsLog?: ScoreBreakdown | null;
  basePointsOverride?: number | null; totalPointsOverride?: number | null;
};

function roundComponent(value: number) {
  return Math.round(Math.max(0, value) * 100) / 100;
}

/**
 * Split the stored base score for display without changing or re-scoring the
 * saved ledger. Run distance points use the challenge's 1-point-per-km base;
 * the remaining stored base score is the pace component. Other activities do
 * not have a pace component, so their stored base score is shown as distance
 * points.
 */
function displayBreakdown(activity: ExplainedActivity, log: ScoreBreakdown): ScoreDisplayBreakdown {
  const basePoints = roundComponent(log.basePoints);
  if (activity.category !== 'RUN') {
    return { ...log, distancePoints: basePoints, pacePoints: 0 };
  }

  const distance = typeof activity.distance === 'number' && Number.isFinite(activity.distance)
    ? roundComponent(activity.distance)
    : basePoints;
  const distancePoints = Math.min(basePoints, distance);
  const pacePoints = roundComponent(basePoints - distancePoints);
  return { ...log, distancePoints, pacePoints };
}

/** Explain stored ledger values, never re-score an activity in the browser. */
export function explainScore(activity: ExplainedActivity) {
  const log = activity.pointsLog;
  const status = activity.status === 'APPROVED' ? 'Included in standings'
    : activity.status === 'PENDING' ? 'Pending estimate — not included in standings'
    : 'Rejected — not included in standings';
  if (!log || ![log.basePoints, log.friendBonus, log.totalPoints].every(Number.isFinite) || log.totalPoints !== activity.points) {
    return { status, message: 'Detailed breakdown unavailable. Refresh to load the latest saved scores.', breakdown: null, overridden: false };
  }
  const breakdown = displayBreakdown(activity, log);
  const overridden = activity.basePointsOverride !== null && activity.basePointsOverride !== undefined
    || activity.totalPointsOverride !== null && activity.totalPointsOverride !== undefined;
  if (overridden) {
    return { status, message: 'Administrator score override applied. Friend-bonus allocation remains automatic.', breakdown, overridden: true };
  }
  const message = activity.status === 'REJECTED' ? 'No friend bonus is awarded to a rejected activity.'
    : activity.category === 'TROOP_GAMES' ? 'Troop Games uses fixed session points; no friend bonus.'
    : log.friendBonus > 0 ? `+${log.friendBonus} friend bonus ${activity.status === 'PENDING' ? 'estimated' : 'applied'} for this sport and Singapore date.`
    : !activity.completedWithFriend ? 'Solo activity — no friend bonus.'
    : activity.points <= 0 ? 'This activity does not meet the qualifying scoring minimum; no friend bonus.'
    : 'No friend bonus allocated to this entry. The allowance is limited to once per sport per Singapore date.';
  return { status, message, breakdown, overridden: false };
}
