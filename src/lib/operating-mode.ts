import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

export type OperatingMode = 'NORMAL' | 'PAUSED' | 'READ_ONLY';
export type OperatingState = { mode: OperatingMode; message: string; updatedAt: string };
type ModeRow = { maintenanceMode: boolean; readOnlyMode: boolean; maintenanceMessage: string; updatedAt: Date };

export async function getOperatingState(db: Pick<Prisma.TransactionClient, '$queryRaw'> = prisma): Promise<OperatingState> {
  const rows = await db.$queryRaw<ModeRow[]>`SELECT "maintenanceMode", "maintenanceMessage", "updatedAt",
    coalesce((to_jsonb(s)->>'readOnlyMode')::boolean,false) AS "readOnlyMode"
    FROM "ChallengeSetting" s WHERE id='primary' LIMIT 1`;
  if (!rows[0]) throw new Error('Challenge controls unavailable');
  const row = rows[0];
  return { mode: row.readOnlyMode ? 'READ_ONLY' : row.maintenanceMode ? 'PAUSED' : 'NORMAL', message: row.maintenanceMessage || 'Competition changes are temporarily paused.', updatedAt: row.updatedAt.toISOString() };
}

export class FeatureError extends Error {
  constructor(message: string, public status = 400, public details?: unknown) { super(message); }
}

export async function assertCompetitionWritable(db: Prisma.TransactionClient, participant = false) {
  const rows = await db.$queryRaw<ModeRow[]>`SELECT "maintenanceMode", "readOnlyMode", "maintenanceMessage", "updatedAt" FROM "ChallengeSetting" WHERE id='primary' FOR SHARE`;
  if (!rows[0]) throw new FeatureError('Challenge controls unavailable. Please retry.', 503);
  if (rows[0].readOnlyMode || (participant && rows[0].maintenanceMode)) throw new FeatureError(rows[0].maintenanceMessage || 'Competition changes are temporarily locked.', 423);
}

export function requireSameOrigin(request: Request) {
  if (request.headers.get('sec-fetch-site') === 'cross-site') throw new FeatureError('Cross-site changes are not allowed.', 403);
  const origin = request.headers.get('origin');
  if (!origin) return; // Authenticated non-browser JSON clients retain compatibility.
  // Next's internal request URL can differ behind a proxy (including localhost
  // versus 127.0.0.1 in CI). Trust exact server-configured origins, not arbitrary
  // forwarded-host headers or a wildcard covering every vercel.app deployment.
  const allowed = new Set([new URL(request.url).origin]);
  for (const value of [process.env.NEXTAUTH_URL, process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined]) {
    if (!value) continue;
    try { const url = new URL(value); if (['https:', 'http:'].includes(url.protocol)) allowed.add(url.origin); } catch { /* Invalid configuration cannot extend trust. */ }
  }
  if (!allowed.has(origin)) throw new FeatureError('Cross-site changes are not allowed.', 403);
}
