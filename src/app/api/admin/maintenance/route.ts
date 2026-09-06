import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { requireAdmin } from '@/lib/adminGuard';
import { prisma } from '@/lib/prisma';
import { FeatureError, getOperatingState, requireSameOrigin } from '@/lib/operating-mode';

const schema = z.object({
  mode: z.enum(['NORMAL','PAUSED','READ_ONLY']),
  message: z.string().trim().min(3).max(240),
  confirmation: z.string(),
  expectedUpdatedAt: z.string().datetime(),
}).strict().refine((data) => data.confirmation === data.mode, 'Type the selected mode to confirm.');

export async function GET() {
  const guard = await requireAdmin();
  if (guard.error) return NextResponse.json({ error: guard.error }, { status: guard.status });
  return NextResponse.json(await getOperatingState(), { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (guard.error) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    requireSameOrigin(request);
    const data = schema.parse(await request.json());
    const state = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "ChallengeSetting" WHERE id='primary' FOR UPDATE`;
      const previous = await getOperatingState(tx);
      if (previous.updatedAt !== data.expectedUpdatedAt) throw new FeatureError('Settings changed in another session. Reload these controls and try again.', 409);
      await tx.$executeRaw`UPDATE "ChallengeSetting" SET "maintenanceMode"=${data.mode !== 'NORMAL'}, "readOnlyMode"=${data.mode === 'READ_ONLY'}, "maintenanceMessage"=${data.message}, "updatedAt"=CURRENT_TIMESTAMP WHERE id='primary'`;
      const actor = await tx.user.findUnique({ where: { id: guard.userId }, select: { name: true } });
      const details = JSON.stringify({ previousMode: previous.mode, mode: data.mode, message: data.message });
      await tx.$executeRaw`INSERT INTO "AdminAudit" (id,"actorId","actorName",action,target,details) VALUES (${randomUUID()},${guard.userId},${actor?.name ?? 'Administrator'},'MAINTENANCE_MODE_CHANGED','Competition controls',${details}::jsonb)`;
      return getOperatingState(tx);
    });
    return NextResponse.json(state, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? 'Invalid controls' }, { status: 400 });
    if (error instanceof FeatureError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Maintenance control update failed:', error);
    return NextResponse.json({ error: 'Could not update controls. Reload and check the current mode before retrying.' }, { status: 500 });
  }
}
