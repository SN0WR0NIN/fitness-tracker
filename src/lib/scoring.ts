/**
 * Scoring algorithm for fitness activities.
 * Rules per the official KG Stay Active Challenge point system:
 * - Run: 1pt/km base + pace bonus (+1.5/km below 5:00, +1.0/km below 6:00, +0.5/km through 9:00).
 *   Runs slower than 9:00/km remain runs but receive no pace bonus.
 * - Cycle: 1pt per 3km.
 * - Swim: 1pt per 100m.
 * - Walk/Hike: 1pt/km, but requires a minimum 5km distance to count at all.
 * - Troop Games: 5 points flat.
 * - Friend bonus: +3 per participant / Singapore day / eligible sport; maximum 12 across four sports.
 *   No extra bonus for Troop Games, repeated same-sport entries, or extra friends.
 * - Final totals are always rounded DOWN to the lower 0.5-point increment.
 */

export type ActivityCategory = 
  | 'RUN'
  | 'CYCLE'
  | 'SWIM'
  | 'WALK_OR_HIKE'
  | 'TROOP_GAMES';

export type RunSegmentKind = 'WORK' | 'RECOVERY';
export type RunSegment = {
  kind: RunSegmentKind;
  distance: number;
  pace: number;
};

export const RUN_SLOW_PACE_THRESHOLD_MIN_PER_KM = 9; // runs slower than this receive no pace bonus
export const WALK_MIN_DISTANCE_KM = 5; // minimum distance for a Walk/Hike entry to count

export type ScoringRules = {
  runBasePerKm: number;
  runFastBonusPerKm: number;
  runMediumBonusPerKm: number;
  runStandardBonusPerKm: number;
  runFastPaceThreshold: number;
  runMediumPaceThreshold: number;
  runSlowPaceThreshold: number;
  cycleKmPerPoint: number;
  swimMetersPerPoint: number;
  walkPointsPerKm: number;
  walkMinimumKm: number;
  troopGamePoints: number;
  friendBonus: number;
};

export const DEFAULT_SCORING_RULES: ScoringRules = {
  runBasePerKm: 1,
  runFastBonusPerKm: 1.5,
  runMediumBonusPerKm: 1,
  runStandardBonusPerKm: 0.5,
  runFastPaceThreshold: 5,
  runMediumPaceThreshold: 6,
  runSlowPaceThreshold: 9,
  cycleKmPerPoint: 3,
  swimMetersPerPoint: 100,
  walkPointsPerKm: 1,
  walkMinimumKm: 5,
  troopGamePoints: 5,
  friendBonus: 3,
};

interface ScoringInput {
  category: ActivityCategory;
  distance?: number; // km for run/cycle/hike, meters for swim
  pace?: number; // min/km
  runSegments?: readonly RunSegment[];
  completedWithFriend?: boolean;
}

interface ScoringOutput {
  basePoints: number;
  friendBonus: number;
  totalPoints: number;
}

/**
 * Floor a non-negative score to the lower half-point. The tiny tolerance only
 * protects exact half-point values from floating-point representation noise;
 * it never promotes a genuinely lower score into the next half-point band.
 */
export function roundScoreDown(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.floor((value + 1e-9) * 2) / 2;
}

/**
 * Preserve the submitted activity category. The slow-run threshold now affects
 * only the pace bonus; runs slower than the threshold remain RUN activities.
 */
export function resolveEffectiveCategory(
  category: ActivityCategory,
  _pace?: number,
  _rules: ScoringRules = DEFAULT_SCORING_RULES
): ActivityCategory {
  return category;
}

export function runPaceBonusPerKm(pace: number, rules: ScoringRules = DEFAULT_SCORING_RULES): number {
  if (pace > rules.runSlowPaceThreshold) return 0;
  if (pace < rules.runFastPaceThreshold) return rules.runFastBonusPerKm;
  if (pace < rules.runMediumPaceThreshold) return rules.runMediumBonusPerKm;
  return rules.runStandardBonusPerKm;
}

/**
 * Treat interval data from the database or request boundary as untrusted. Only
 * complete, finite segments are accepted; callers decide whether an empty
 * result means "steady run" or invalid interval input.
 */
export function normalizeRunSegments(value: unknown): RunSegment[] {
  if (!Array.isArray(value) || value.length > 20) return [];
  const normalized: RunSegment[] = [];
  for (const segment of value) {
    if (!segment || typeof segment !== 'object') return [];
    const candidate = segment as Record<string, unknown>;
    const kind = candidate.kind;
    const distance = candidate.distance;
    const pace = candidate.pace;
    if ((kind !== 'WORK' && kind !== 'RECOVERY')
      || typeof distance !== 'number' || !Number.isFinite(distance) || distance <= 0
      || typeof pace !== 'number' || !Number.isFinite(pace) || pace <= 0 || pace > 60) return [];
    normalized.push({ kind, distance, pace });
  }
  return normalized;
}

export function summarizeRunSegments(segments: readonly RunSegment[]) {
  const distance = segments.reduce((total, segment) => total + segment.distance, 0);
  const pace = distance > 0
    ? segments.reduce((total, segment) => total + segment.distance * segment.pace, 0) / distance
    : undefined;
  return { distance, pace };
}

export function runSegmentPoints(segment: RunSegment, rules: ScoringRules = DEFAULT_SCORING_RULES): number {
  return segment.distance * (rules.runBasePerKm + runPaceBonusPerKm(segment.pace, rules));
}

/** Raw activity value before display rounding, friend bonus, or final half-point flooring. */
function rawBasePoints(input: Pick<ScoringInput, 'category' | 'distance' | 'pace' | 'runSegments'>, rules: ScoringRules): number {
  switch (input.category) {
    case 'RUN':
      if (input.runSegments?.length) {
        return input.runSegments.reduce((total, segment) => total + runSegmentPoints(segment, rules), 0);
      }
      if (input.distance) {
        const bonusPerKm = input.pace !== undefined ? runPaceBonusPerKm(input.pace, rules) : 0;
        return input.distance * (rules.runBasePerKm + bonusPerKm);
      }
      return 0;
    case 'CYCLE':
      return input.distance ? input.distance / rules.cycleKmPerPoint : 0;
    case 'SWIM':
      return input.distance ? input.distance / rules.swimMetersPerPoint : 0;
    case 'WALK_OR_HIKE':
      return input.distance && input.distance >= rules.walkMinimumKm ? input.distance * rules.walkPointsPerKm : 0;
    case 'TROOP_GAMES':
      return rules.troopGamePoints;
  }
}

/**
 * Friend-bonus eligibility must use the unrounded activity value. This keeps a
 * valid tiny positive Run/Cycle/Swim eligible even when its solo saved score
 * floors below 0.5 points, while sub-minimum Walk/Hike entries remain ineligible.
 */
export function hasPositiveBaseScore(
  input: Pick<ScoringInput, 'category' | 'distance' | 'pace' | 'runSegments'>,
  rules: ScoringRules = DEFAULT_SCORING_RULES
): boolean {
  return rawBasePoints(input, rules) > 0;
}

/**
 * Calculate points based on activity type and metrics.
 * Callers may pass the category returned by resolveEffectiveCategory(); it now
 * preserves the submitted category while pace controls the run bonus.
 */
export function calculateActivityPoints(input: ScoringInput, rules: ScoringRules = DEFAULT_SCORING_RULES): ScoringOutput {
  const basePoints = rawBasePoints(input, rules);

  // Daily allocation is enforced by planDailyActivityScores in the server ledger.
  // The standalone calculation represents a maximum eligible estimate only.
  const friendBonus = input.completedWithFriend && input.category !== 'TROOP_GAMES' && basePoints > 0 ? rules.friendBonus : 0;
  const totalPoints = roundScoreDown(basePoints + friendBonus);

  return {
    basePoints: Math.round(basePoints * 100) / 100,
    friendBonus,
    totalPoints,
  };
}

/**
 * Calculate week start date (previous Sunday from given date)
 */
export function getWeekStart(date: Date): Date {
  // A UTC calendar key representing the Sunday in Singapore, not an instant.
  const local = new Date(date.getTime() + 8 * 3600000);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - local.getUTCDay()));
}

export function getWeekNumber(date: Date, periodStartDate: Date = new Date('2026-09-01T00:00:00Z')): number {
  const diff = getWeekStart(date).getTime() - getWeekStart(periodStartDate).getTime();
  return Math.floor(diff / (7 * 86400000)) + 1;
}

/**
 * Format date for display (e.g., "Sun (16/08/26)")
 */
export function formatWeekStart(date: Date): string {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const day = days[date.getDay()];
  const dateStr = date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
  return `${day} (${dateStr})`;
}
