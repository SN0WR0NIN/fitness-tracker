/** Classify only transaction-aborting serialization/deadlock errors. Prisma 5
 * can wrap Postgres 40P01 as UnknownRequestError without a top-level code. */
export function isRetryableScoringConflict(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const value = error as { code?: string; name?: string; message?: string; meta?: { code?: string } };
  if (value.code === 'P2034') return true;
  if (value.code === 'P2010' && ['40001', '40P01'].includes(value.meta?.code ?? '')) return true;
  return value.name === 'PrismaClientUnknownRequestError' && typeof value.message === 'string'
    && /PostgresError\s*\{\s*code:\s*"(?:40001|40P01)"/.test(value.message);
}
