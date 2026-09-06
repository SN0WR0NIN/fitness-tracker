import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getChallengeSettings } from '@/lib/admin-control';
import { parseActivityDate } from '@/lib/activity-date';
import { calculateActivityPoints } from '@/lib/scoring';
import { FRIEND_BONUS_SPORTS } from '@/lib/daily-friend-bonus';

export const dynamic = 'force-dynamic';
const Query = z.object({ activityDate: z.string(), category: z.enum(['RUN','CYCLE','SWIM','WALK_OR_HIKE','TROOP_GAMES']), userId: z.string().min(1).optional() });
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const parsed = Query.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: 'Choose a date and sport.' }, { status: 400 });
  const { category, activityDate } = parsed.data;
  const userId = parsed.data.userId ?? session.user.id;
  if (userId !== session.user.id && session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Not permitted.' }, { status: 403 });
  const start = parseActivityDate(activityDate);
  if (!start) return NextResponse.json({ error: 'Choose a valid Singapore activity date.' }, { status: 400 });
  try {
    const settings = await getChallengeSettings();
    const candidates = await prisma.activity.findMany({ where: { userId, category, completedWithFriend: true,
      status: { in: ['APPROVED','PENDING'] }, occurredAt: { gte: start, lt: new Date(start.getTime() + 86400000) } },
      select: { distance: true, pace: true, status: true } });
    const qualifying = candidates.filter(a => calculateActivityPoints({ category, distance: a.distance, pace: a.pace ?? undefined }, settings.scoringRules).basePoints > 0);
    const used = qualifying.some(a => a.status === 'APPROVED');
    const pending = qualifying.some(a => a.status === 'PENDING');
    return NextResponse.json({ eligibleSport: FRIEND_BONUS_SPORTS.includes(category), used, pending,
      available: FRIEND_BONUS_SPORTS.includes(category) && !used && !pending,
      bonus: settings.scoringRules.friendBonus, maxDailyBonus: 4 * settings.scoringRules.friendBonus }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ error: 'Bonus availability could not be checked.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
