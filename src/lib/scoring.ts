/**
 * Scoring algorithm for fitness activities.
 * Rules per the official KG Stay Active Challenge point system:
 * - Run: 1pt/km base + pace bonus (>6min/km: +0.5/km, <6min/km: +1.0/km, <5min/km: +1.5/km).
 *   Runs slower than 9:00/km are not runs — they get auto-recategorized as Walk/Hike.
 * - Cycle: 1pt per 3km.
 * - Swim: 1pt per 100m.
 * - Walk/Hike: 1pt/km, but requires a minimum 5km distance to count at all.
 * - Troop Games: 5 points flat.
 * - Friend bonus: +3pts, only when completed with a verified registered companion.
 * - Final totals are rounded UP to the nearest 0.5 point.
 */

export type ActivityCategory = 
  | 'RUN'
  | 'CYCLE'
  | 'SWIM'
  | 'WALK_OR_HIKE'
  | 'TROOP_GAMES';

export const RUN_SLOW_PACE_THRESHOLD_MIN_PER_KM = 9; // runs slower than this are recategorized as a walk
export const WALK_MIN_DISTANCE_KM = 5; // minimum distance for a Walk/Hike entry to count

interface ScoringInput {
  category: ActivityCategory;
  distance?: number; // km for run/cycle/hike, meters for swim
  pace?: number; // min/km
  completedWithFriend?: boolean;
}

interface ScoringOutput {
  basePoints: number;
  friendBonus: number;
  totalPoints: number;
}

/**
 * A "Run" submitted with a pace slower than the slow-pace threshold isn't a
 * real run per the rules — it gets auto-recategorized as Walk/Hike instead.
 * Returns the effective category to actually score and store.
 */
export function resolveEffectiveCategory(
  category: ActivityCategory,
  pace?: number
): ActivityCategory {
  if (category === 'RUN' && pace !== undefined && pace > RUN_SLOW_PACE_THRESHOLD_MIN_PER_KM) {
    return 'WALK_OR_HIKE';
  }
  return category;
}

function runPaceBonusPerKm(pace: number): number {
  if (pace < 5) return 1.5;
  if (pace < 6) return 1.0;
  return 0.5; // pace >= 6 (includes exactly 6:00/km)
}

/**
 * Calculate points based on activity type and metrics.
 * NOTE: callers should pass the category returned by resolveEffectiveCategory(),
 * not the raw user-selected category, so slow "runs" score as walks.
 */
export function calculateActivityPoints(input: ScoringInput): ScoringOutput {
  let basePoints = 0;

  switch (input.category) {
    case 'RUN':
      if (input.distance) {
        const bonusPerKm = input.pace !== undefined ? runPaceBonusPerKm(input.pace) : 0;
        basePoints = input.distance * (1 + bonusPerKm);
      }
      break;

    case 'CYCLE':
      if (input.distance) {
        basePoints = input.distance / 3;
      }
      break;

    case 'SWIM':
      if (input.distance) {
        basePoints = input.distance / 100;
      }
      break;

    case 'WALK_OR_HIKE':
      if (input.distance && input.distance >= WALK_MIN_DISTANCE_KM) {
        basePoints = input.distance;
      }
      break;

    case 'TROOP_GAMES':
      basePoints = 5;
      break;
  }

  const friendBonus = input.completedWithFriend ? 3 : 0;
  const totalPoints = Math.ceil((basePoints + friendBonus) * 2) / 2;

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
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day;
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Calculate week number from a given date
 * Week 1 starts from the first week containing activities
 */
export function getWeekNumber(date: Date, periodStartDate: Date = new Date(2026, 7, 16)): number {
  const weekStart = getWeekStart(date);
  const periodStart = getWeekStart(periodStartDate);
  
  const diffTime = Math.abs(weekStart.getTime() - periodStart.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return Math.floor(diffDays / 7) + 1;
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
