import { prisma } from '@/lib/prisma';

export type SystemHealthDetails = {
  users: number;
  activities: number;
  pending: number;
  approved: number;
  rejected: number;
  score_mismatches: number;
  negative_scores: number;
  orphan_activity_users: number;
  orphan_activity_columns: number;
  duplicate_proof_groups: number;
  duplicate_strava_groups: number;
  approved_without_reviewer: number;
  rejected_without_reason: number;
  outside_challenge_window: number;
  possible_duplicate_pairs: number;
  latest_backup_at: string | null;
  checked_at: string;
};

export type ScheduledHealth = {
  id: string;
  status: 'HEALTHY' | 'WARN' | 'ERROR';
  details: SystemHealthDetails;
  createdAt: Date;
};

export type OperationalBackupSummary = {
  id: string;
  format: string;
  version: number;
  checksumSha256: string;
  counts: Record<string, number>;
  createdAt: Date;
};

export async function getLatestScheduledHealth(): Promise<ScheduledHealth | null> {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT id, status, details, created_at AS "createdAt"
    FROM app_internal.system_health_check
    ORDER BY created_at DESC
    LIMIT 1
  `) as ScheduledHealth[];
  return rows[0] ?? null;
}

export async function getLatestOperationalBackupSummary(): Promise<OperationalBackupSummary | null> {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT id, format, version, checksum_sha256 AS "checksumSha256", counts, created_at AS "createdAt"
    FROM app_internal.operational_backup
    ORDER BY created_at DESC
    LIMIT 1
  `) as OperationalBackupSummary[];
  return rows[0] ?? null;
}

export async function getLatestOperationalBackupPayload(): Promise<{ payload: unknown; createdAt: Date } | null> {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT payload, created_at AS "createdAt"
    FROM app_internal.operational_backup
    ORDER BY created_at DESC
    LIMIT 1
  `) as Array<{ payload: unknown; createdAt: Date }>;
  return rows[0] ?? null;
}
