import { DEFAULT_SCORING_RULES, type ScoringRules } from './scoring';

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

function rate(value: number) {
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
}

function paceLabel(value: number) {
  const minutes = Math.floor(value);
  const seconds = Math.round((value - minutes) * 60);
  const adjustedMinutes = seconds === 60 ? minutes + 1 : minutes;
  const adjustedSeconds = seconds === 60 ? 0 : seconds;
  return `${adjustedMinutes}:${adjustedSeconds.toString().padStart(2, '0')}`;
}

function runPaceRate(pace: number | null | undefined, rules: ScoringRules) {
  if (pace === null || pace === undefined || !Number.isFinite(pace)) return 0;
  if (pace < rules.runFastPaceThreshold) return rules.runFastBonusPerKm;
  if (pace < rules.runMediumPaceThreshold) return rules.runMediumBonusPerKm;
  return rules.runStandardBonusPerKm;
}

/** Split the stored score for display while keeping the saved PointsLog authoritative. */
export function getScoreDisplayBreakdown(
  activity: ExplainedActivity,
  log: ScoreBreakdown,
  rules: ScoringRules = DEFAULT_SCORING_RULES,
): ScoreDisplayBreakdown {
  const basePoints = roundComponent(log.basePoints);
  if (activity.category !== 'RUN') {
    return { ...log, distancePoints: basePoints, pacePoints: 0 };
  }

  const distance = typeof activity.distance === 'number' && Number.isFinite(activity.distance) ? activity.distance : null;
  const calculatedDistancePoints = distance === null ? basePoints : roundComponent(distance * rules.runBasePerKm);
  // Overrides can make the stored base lower than the ordinary distance component.
  const distancePoints = Math.min(basePoints, calculatedDistancePoints);
  const pacePoints = roundComponent(basePoints - distancePoints);
  return { ...log, distancePoints, pacePoints };
}

function calculationLines(
  activity: ExplainedActivity,
  breakdown: ScoreDisplayBreakdown,
  rules: ScoringRules,
  overridden: boolean,
) {
  if (overridden) {
    return [
      'Administrator score override applied. The saved score components shown here are authoritative.',
      `Friend bonus: +${breakdown.friendBonus.toFixed(1)} pts.`,
      `Final saved total: ${breakdown.totalPoints.toFixed(1)} pts.`,
    ];
  }

  const distance = typeof activity.distance === 'number' && Number.isFinite(activity.distance) ? activity.distance : 0;
  const lines: string[] = [];
  if (activity.category === 'RUN') {
    lines.push(`Distance: ${distance.toFixed(2)} km × ${rate(rules.runBasePerKm)} pt/km = ${breakdown.distancePoints.toFixed(1)} pts.`);
    if (activity.pace !== null && activity.pace !== undefined && Number.isFinite(activity.pace)) {
      const paceBonus = runPaceRate(activity.pace, rules);
      lines.push(`Pace: ${paceLabel(activity.pace)}/km → +${rate(paceBonus)} pt/km = ${breakdown.pacePoints.toFixed(1)} pts.`);
    } else {
      lines.push(`Pace: no pace bonus recorded = ${breakdown.pacePoints.toFixed(1)} pts.`);
    }
  } else if (activity.category === 'CYCLE') {
    lines.push(`Distance: ${distance.toFixed(2)} km ÷ ${rate(rules.cycleKmPerPoint)} km/pt = ${breakdown.distancePoints.toFixed(1)} pts.`);
  } else if (activity.category === 'SWIM') {
    lines.push(`Distance: ${distance.toFixed(0)} m ÷ ${rate(rules.swimMetersPerPoint)} m/pt = ${breakdown.distancePoints.toFixed(1)} pts.`);
  } else if (activity.category === 'WALK_OR_HIKE') {
    lines.push(`Distance: ${distance.toFixed(2)} km × ${rate(rules.walkPointsPerKm)} pt/km = ${breakdown.distancePoints.toFixed(1)} pts.`);
  } else if (activity.category === 'TROOP_GAMES') {
    lines.push(`Troop Games: fixed session score = ${breakdown.totalPoints.toFixed(1)} pts.`);
  }

  if (activity.category !== 'TROOP_GAMES') lines.push(`Friend bonus: +${breakdown.friendBonus.toFixed(1)} pts.`);
  lines.push(`Final total: ${breakdown.totalPoints.toFixed(1)} pts after rounding down to the lower 0.5-point increment.`);
  return lines;
}

/** Explain stored ledger values; the ledger remains the source of truth. */
export function explainScore(activity: ExplainedActivity, rules: ScoringRules = DEFAULT_SCORING_RULES) {
  const log = activity.pointsLog;
  const status = activity.status === 'APPROVED' ? 'Included in standings'
    : activity.status === 'PENDING' ? 'Pending estimate — not included in standings'
    : 'Rejected — not included in standings';
  if (!log || ![log.basePoints, log.friendBonus, log.totalPoints].every(Number.isFinite) || log.totalPoints !== activity.points) {
    return { status, message: 'Detailed breakdown unavailable. Refresh to load the latest saved scores.', breakdown: null, overridden: false, calculation: [] as string[] };
  }
  const breakdown = getScoreDisplayBreakdown(activity, log, rules);
  const overridden = activity.basePointsOverride !== null && activity.basePointsOverride !== undefined
    || activity.totalPointsOverride !== null && activity.totalPointsOverride !== undefined;
  const message = overridden ? 'Administrator score override applied. Friend-bonus allocation remains automatic.'
    : activity.status === 'REJECTED' ? 'No friend bonus is awarded to a rejected activity.'
    : activity.category === 'TROOP_GAMES' ? 'Troop Games uses fixed session points; no friend bonus.'
    : log.friendBonus > 0 ? `+${log.friendBonus} friend bonus ${activity.status === 'PENDING' ? 'estimated' : 'applied'} for this sport and Singapore date.`
    : !activity.completedWithFriend ? 'Solo activity — no friend bonus.'
    : activity.points <= 0 ? 'This activity does not meet the qualifying scoring minimum; no friend bonus.'
    : 'No friend bonus allocated to this entry. The allowance is limited to once per sport per Singapore date.';
  return { status, message, breakdown, overridden, calculation: calculationLines(activity, breakdown, rules, overridden) };
}
