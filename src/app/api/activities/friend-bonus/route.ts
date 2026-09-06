import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getChallengeSettings } from '@/lib/admin-control';
import { parseActivityDate } from '@/lib/activity-date';
import { resolveEffectiveCategory, type ActivityCategory } from '@/lib/scoring';
import { FRIEND_BONUS_SPORTS, qualifiesForFriendBonus } from '@/lib/daily-friend-bonus';

export const dynamic = 'force-dynamic';
type BonusCandidate = { category: ActivityCategory; distance: number; pace: number | null; status: 'APPROVED' | 'PENDING' };
const Query = z.object({ activityDate: z.string(), category: z.enum(['RUN','CYCLE','SWIM','WALK_OR_HIKE','TROOP_GAMES']), userId: z.string().min(1).max(200).optional() });
const headers = { 'Cache-Control': 'private, no-store' };
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Not authenticated' }, { status: 401, headers });
  const parsed = Query.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: 'Choose a date and sport.' }, { status: 400, headers });
  const { category, activityDate } = parsed.data;
  const userId = parsed.data.userId ?? session.user.id;
  if (userId !== session.user.id && session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Not permitted.' }, { status: 403, headers });
  const start = parseActivityDate(activityDate);
  if (!start) return NextResponse.json({ error: 'Choose a valid Singapore activity date.' }, { status: 400, headers });
  try {
    const settings = await getChallengeSettings();
    // Use effective categories, just like the ledger: a slow run consumes
    // the walking allowance, including older entries awaiting reconciliation.
    const candidates: BonusCandidate[] = await prisma.activity.findMany({ where: { userId, completedWithFriend: true,
      status: { in: ['APPROVED','PENDING'] }, occurredAt: { gte: start, lt: new Date(start.getTime() + 86400000) } },
      select: { category: true, distance: true, pace: true, status: true } });
    const qualifying = candidates.filter(a => resolveEffectiveCategory(a.category, a.pace ?? undefined, settings.scoringRules) === category
      && qualifiesForFriendBonus(a, settings.scoringRules));
    const used = qualifying.some(a => a.status === 'APPROVED');
    const pending = qualifying.some(a => a.status === 'PENDING');
    return NextResponse.json({ eligibleSport: FRIEND_BONUS_SPORTS.includes(category), used, pending,
      available: FRIEND_BONUS_SPORTS.includes(category) && !used && !pending,
      bonus: settings.scoringRules.friendBonus, maxDailyBonus: FRIEND_BONUS_SPORTS.length * settings.scoringRules.friendBonus }, { headers });
  } catch {
    return NextResponse.json({ error: 'Bonus availability could not be checked.' }, { status: 503, headers });
  }
}
