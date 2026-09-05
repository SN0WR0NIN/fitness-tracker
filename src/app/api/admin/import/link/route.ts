import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { requireAdmin } from '@/lib/adminGuard';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (guard.error) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const parsed = z.object({ sourceId: z.string().startsWith('historical_'), targetId: z.string().min(1) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success || parsed.data.sourceId === parsed.data.targetId) return NextResponse.json({ error: 'Choose two different participant records.' }, { status: 400 });
  try {
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const { sourceId, targetId } = parsed.data;
      const [source, target] = await Promise.all([tx.user.findUnique({ where: { id: sourceId } }), tx.user.findUnique({ where: { id: targetId } })]);
      if (!source || source.password !== '!UNCLAIMED' || !target || target.password === '!UNCLAIMED') throw new Error('Invalid participant');
      const scores = await tx.weeklyScore.findMany({ where: { userId: sourceId } });
      for (const score of scores) {
        const { id: _id, userId: _userId, createdAt: _createdAt, updatedAt: _updatedAt, ...data } = score;
        void _id; void _userId; void _createdAt; void _updatedAt;
        await tx.weeklyScore.upsert({ where: { userId_weekStart: { userId: targetId, weekStart: score.weekStart } }, create: { ...data, userId: targetId }, update: { totalPoints: { increment: score.totalPoints }, runPoints: { increment: score.runPoints }, cyclePoints: { increment: score.cyclePoints }, swimPoints: { increment: score.swimPoints }, hikePoints: { increment: score.hikePoints }, troopGamePoints: { increment: score.troopGamePoints } } });
      }
      await tx.activity.updateMany({ where: { userId: sourceId }, data: { userId: targetId } });
      await tx.activity.updateMany({ where: { companionUserId: sourceId }, data: { companionUserId: targetId, companion: target.name } });
      await tx.activity.updateMany({ where: { reviewedById: sourceId }, data: { reviewedById: targetId } });
      await tx.weeklyScore.deleteMany({ where: { userId: sourceId } });
      // The empty, login-disabled placeholder is removed only after its history is transferred.
      await tx.user.delete({ where: { id: sourceId } });
    }, { isolationLevel: 'Serializable' });
    return NextResponse.json({ linked: true });
  } catch {
    return NextResponse.json({ error: 'Could not link these records. Refresh and check that the source is unclaimed and the destination has signed up.' }, { status: 409 });
  }
}
