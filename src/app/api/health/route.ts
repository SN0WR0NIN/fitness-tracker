import { NextResponse } from 'next/server';
import { getChallengeSettings } from '@/lib/admin-control';
import { prisma } from '@/lib/prisma';
import { requestLog } from '@/lib/telemetry';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const log = requestLog(request, '/api/health');
  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const settings = await getChallengeSettings();
    const payload = {
      status: 'healthy',
      database: 'connected',
      maintenanceMode: settings.maintenanceMode,
      responseTimeMs: Date.now() - startedAt,
      checkedAt: new Date().toISOString(),
      release: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'local',
    };
    log.success({ status: 200, responseTimeMs: payload.responseTimeMs });
    return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    log.failure(error, { status: 503 });
    return NextResponse.json({ status: 'unavailable', database: 'unavailable', checkedAt: new Date().toISOString() }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
