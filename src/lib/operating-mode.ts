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
  // Always fresh, and hold the settings row until the caller's transaction commits.
  const rows = await db.$queryRaw<ModeRow[]>`SELECT "maintenanceMode", "readOnlyMode", "maintenanceMessage", "updatedAt" FROM "ChallengeSetting" WHERE id='primary' FOR SHARE`;
  if (!rows[0]) throw new FeatureError('Challenge controls unavailable. Please retry.', 503);
  if (rows[0].readOnlyMode || (participant && rows[0].maintenanceMode)) throw new FeatureError(rows[0].maintenanceMessage || 'Competition changes are temporarily locked.', 423);
}

export function requireSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if ((origin && origin !== new URL(request.url).origin) || request.headers.get('sec-fetch-site') === 'cross-site') throw new FeatureError('Cross-site changes are not allowed.', 403);
}
