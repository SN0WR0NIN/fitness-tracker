import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { requireAdmin } from '@/lib/adminGuard';
import { getLatestCompletedWeekNumber, rebuildWeeklyCompetitionResult } from '@/lib/competition-results';
import { recordAdminAudit } from '@/lib/admin-control';

const Schema = z.object({ weekNumber: z.number().int().min(1).max(60) });

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (guard.error) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const { weekNumber } = Schema.parse(await request.json());
    const latestCompleted = await getLatestCompletedWeekNumber();
    if (weekNumber > latestCompleted) return NextResponse.json({ error: 'That week has not completed yet.' }, { status: 400 });
    const resultKey = await rebuildWeeklyCompetitionResult(weekNumber);
    await recordAdminAudit(guard.userId, 'Rebuilt weekly awards', `Week ${weekNumber}`, { resultKey });
    return NextResponse.json({ ok: true, weekNumber, resultKey });
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ error: error.issues[0]?.message || 'Invalid week number.' }, { status: 400 });
    console.error('Unable to rebuild weekly awards:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to rebuild weekly awards.' }, { status: 500 });
  }
}
