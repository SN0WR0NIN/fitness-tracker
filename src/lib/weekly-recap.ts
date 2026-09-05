const DAY = 86400000;
const OFFSET = 8 * 3600000;
const DEFAULT_CHALLENGE_START = new Date('2026-09-01T00:00:00+08:00');

export function recapWeek(date: Date, challengeStart: Date = DEFAULT_CHALLENGE_START) {
  const local = new Date(date.getTime() + OFFSET);
  const sunday = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - local.getUTCDay()) - OFFSET);
  const end = new Date(sunday.getTime() + 7 * DAY);
  const start = sunday < challengeStart && end > challengeStart ? challengeStart : sunday;
  const priorSunday = new Date(sunday.getTime() - 7 * DAY);
  const previousStart = priorSunday < challengeStart && sunday > challengeStart ? challengeStart : priorSunday;
  return { start, end, previousStart };
}

export type RecapActivity = { status: string; occurredAt: Date; points: number; user: { id: string; name: string }; column: { id: string; name: string } };

export function buildWeeklyRecap(rows: RecapActivity[], start: Date, end: Date, challengeStart: Date = DEFAULT_CHALLENGE_START) {
  const approved = rows.filter((row) => row.status === 'APPROVED');
  const current = approved.filter((row) => row.occurredAt >= start && row.occurredAt < end);
  const previousStart = recapWeek(start, challengeStart).previousStart;
  const previous = approved.filter((row) => row.occurredAt >= previousStart && row.occurredAt < start);
  const total = current.reduce((sum, row) => sum + row.points, 0);
  const previousTotal = previous.reduce((sum, row) => sum + row.points, 0);
  function ranking(kind: 'user' | 'column') {
    const totals = new Map<string, { name: string; points: number }>();
    for (const row of current) {
      const entry = totals.get(row[kind].id) ?? { name: row[kind].name, points: 0 };
      entry.points += row.points;
      totals.set(row[kind].id, entry);
    }
    let rank = 0;
    let last: number | undefined;
    return [...totals.values()].sort((a, b) => b.points - a.points || a.name.localeCompare(b.name)).map((row, index) => {
      if (row.points !== last) rank = index + 1;
      last = row.points;
      return { ...row, rank };
    });
  }
  const date = (value: Date) => value.toLocaleDateString('en-SG', { timeZone: 'Asia/Singapore', day: 'numeric', month: 'short', year: 'numeric' });
  const lines = ['🏆 Kilo Golf Stay Active — Weekly Recap', `${date(start)} – ${date(new Date(end.getTime() - 1))} (SGT)`, '', `💪 ${new Set(current.map(row => row.user.id)).size} active athletes · ${current.length} approved activities`, `⭐ ${total.toFixed(1)} points earned`, `Compared with the previous week: ${total - previousTotal >= 0 ? '+' : ''}${(total - previousTotal).toFixed(1)} points`, '', 'COLUMN STANDINGS — THIS WEEK'];
  for (const row of ranking('column')) lines.push(`${row.rank}. ${row.name} — ${row.points.toFixed(1)} pts`);
  if (!current.length) lines.push('No approved activities for this week yet.');
  lines.push('', 'TOP ATHLETES — THIS WEEK');
  for (const row of ranking('user').filter(row => row.rank <= 3)) lines.push(`${row.rank}. ${row.name} — ${row.points.toFixed(1)} pts`);
  lines.push('', 'Every activity counts. Keep moving for your Column!', 'https://kg-stay-active-challenge.vercel.app/leaderboard', '', 'Approved submissions only. Totals may change after reviews or corrections.');
  return lines.join('\n');
}
