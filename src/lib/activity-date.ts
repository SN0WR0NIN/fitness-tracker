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
