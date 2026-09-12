import { prisma } from "@/lib/prisma";

type ActivityStats = {
  total: number;
  noProof: number;
  singleProof: number;
  multipleProofs: number;
  maxedProofs: number;
  proofMismatches: number;
  rejected: number;
  rejectedSevenDays: number;
  scoreOverrides: number;
};

type UploadStats = { failuresSevenDays: number; latestFailureAt: Date | null };
type StorageStats = { storedObjects: number; unattachedObjects: number };

export type AdminOperationsAnalytics = {
  activity: ActivityStats;
  uploads: UploadStats;
  storage: StorageStats | null;
};

export async function getAdminOperationsAnalytics(): Promise<AdminOperationsAnalytics> {
  const [activityRows, uploadRows, storage] = await Promise.all([
    prisma.$queryRaw<Array<ActivityStats>>`
      WITH proof_counts AS (
        SELECT *, GREATEST(cardinality("proofUrls"), CASE WHEN "proofUrl" IS NULL THEN 0 ELSE 1 END) AS proof_count
        FROM "Activity"
      )
      SELECT
        count(*)::int AS total,
        count(*) FILTER (WHERE proof_count=0)::int AS "noProof",
        count(*) FILTER (WHERE proof_count=1)::int AS "singleProof",
        count(*) FILTER (WHERE proof_count>1)::int AS "multipleProofs",
        count(*) FILTER (WHERE proof_count=5)::int AS "maxedProofs",
        count(*) FILTER (WHERE (cardinality("proofUrls")=0 AND "proofUrl" IS NOT NULL) OR (cardinality("proofUrls")>0 AND "proofUrl" IS DISTINCT FROM "proofUrls"[1]))::int AS "proofMismatches",
        count(*) FILTER (WHERE status='REJECTED')::int AS rejected,
        count(*) FILTER (WHERE status='REJECTED' AND "updatedAt">=now()-interval '7 days')::int AS "rejectedSevenDays",
        count(*) FILTER (WHERE "basePointsOverride" IS NOT NULL OR "totalPointsOverride" IS NOT NULL)::int AS "scoreOverrides"
      FROM proof_counts
    `,
    prisma.$queryRaw<Array<UploadStats>>`
      SELECT
        count(*) FILTER (WHERE "createdAt">=now()-interval '7 days')::int AS "failuresSevenDays",
        max("createdAt") AS "latestFailureAt"
      FROM "PerformanceMetric"
      WHERE route='/api/upload' AND metric='request_failure'
    `,
    getStorageStats().catch(() => null),
  ]);

  return {
    activity: activityRows[0] ?? {
      total: 0,
      noProof: 0,
      singleProof: 0,
      multipleProofs: 0,
      maxedProofs: 0,
      proofMismatches: 0,
      rejected: 0,
      rejectedSevenDays: 0,
      scoreOverrides: 0,
    },
    uploads: uploadRows[0] ?? { failuresSevenDays: 0, latestFailureAt: null },
    storage,
  };
}

async function getStorageStats(): Promise<StorageStats> {
  const rows = await prisma.$queryRaw<Array<StorageStats>>`
    SELECT
      count(*)::int AS "storedObjects",
      count(*) FILTER (WHERE NOT EXISTS (
        SELECT 1 FROM "Activity" a
        WHERE a."proofUrl" LIKE '%' || o.name
           OR EXISTS (SELECT 1 FROM unnest(a."proofUrls") proof WHERE proof LIKE '%' || o.name)
      ))::int AS "unattachedObjects"
    FROM storage.objects o
    WHERE o.bucket_id='activity-proofs'
  `;
  return rows[0] ?? { storedObjects: 0, unattachedObjects: 0 };
}
