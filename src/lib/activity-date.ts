/** Calendar dates for manual submissions are interpreted in Singapore time. */
export function singaporeDate(now = new Date()): string {
  return new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function parseActivityDate(value: string, now = new Date()): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '0001-01-01' || value > singaporeDate(now)) return null;
  const date = new Date(`${value}T00:00:00+08:00`);
  if (!Number.isFinite(date.getTime()) || singaporeDate(date) !== value) return null;
  return date;
}

/**
 * Challenge settings are stored as calendar dates. Resolve those dates to
 * Singapore-day boundaries so a 1 September start really begins at midnight
 * SGT rather than eight hours later because of UTC serialization.
 */
export function challengeWindow(startDate: Date, endDate: Date) {
  const startDay = startDate.toISOString().slice(0, 10);
  const endDay = endDate.toISOString().slice(0, 10);
  return {
    start: new Date(`${startDay}T00:00:00.000+08:00`),
    end: new Date(`${endDay}T23:59:59.999+08:00`),
  };
}

export function isWithinChallengeWindow(date: Date, startDate: Date, endDate: Date): boolean {
  const window = challengeWindow(startDate, endDate);
  return date >= window.start && date <= window.end;
}

export function challengeDateRangeLabel(startDate: Date, endDate: Date): string {
  const window = challengeWindow(startDate, endDate);
  const format = (value: Date) => value.toLocaleDateString('en-SG', {
    timeZone: 'Asia/Singapore',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  return `${format(window.start)} to ${format(window.end)}`;
}
