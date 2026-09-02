/**
 * Scoring algorithm for fitness activities
 * Based on distance, pace, and activity type
 */

export type ActivityCategory = 
  | 'RUN'
  | 'CYCLE'
  | 'SWIM'
  | 'WALK_OR_HIKE'
  | 'TROOP_GAMES';

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
 * Calculate points based on activity type and metrics
 * Scoring rules from data analysis:
 * - Run: distance * (12 - pace) / 2, friend bonus +1
 * - Cycle: distance / 1.7, friend bonus +1
 * - Swim: distance / 50, friend bonus +1
 * - Hike: distance * 1.6, friend bonus +1
 * - Troop Games: 5 points base
 */
export function calculateActivityPoints(input: ScoringInput): ScoringOutput {
  let basePoints = 0;

  switch (input.category) {
    case 'RUN':
      if (input.distance && input.pace) {
        // Run scoring: distance * (12 - pace) / 2
        basePoints = Math.max(0, input.distance * (12 - input.pace) / 2);
      }
      break;

    case 'CYCLE':
      if (input.distance) {
        // Cycle scoring: distance / 1.7
        basePoints = input.distance / 1.7;
      }
      break;

    case 'SWIM':
      if (input.distance) {
        // Swim scoring: distance (meters) / 50
        basePoints = input.distance / 50;
      }
      break;

    case 'WALK_OR_HIKE':
      if (input.distance) {
        // Hike scoring: distance * 1.6
        basePoints = input.distance * 1.6;
      }
      break;

    case 'TROOP_GAMES':
      basePoints = 5;
      break;
  }

  const friendBonus = input.completedWithFriend ? 1 : 0;
  const totalPoints = Math.ceil(basePoints + friendBonus);

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
  return new Date(d.setDate(diff));
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
