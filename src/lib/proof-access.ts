import type { Prisma } from '@prisma/client';
import { ActivityEditError } from '@/lib/activity-duplicates';
import { parseProofReference, type ProofReference } from '@/lib/proof-reference';

export const MAX_ACTIVITY_PROOFS = 5;

/** Fixtures cannot activate in a Vercel deployment, even if CI is present. */
export function localProofFixtures(): boolean {
  if (process.env.CI !== 'true' || process.env.E2E_TEST_MODE !== '1' || process.env.VERCEL || process.env.VERCEL_ENV) return false;
  try {
    return new URL(process.env.DATABASE_URL || '').hostname === '127.0.0.1'
      && new URL(process.env.NEXTAUTH_URL || '').hostname === '127.0.0.1';
  } catch { return false; }
}

export function resolveProofReference(value: string): ProofReference | null {
  return parseProofReference(value, process.env.SUPABASE_URL, localProofFixtures());
}

export function normalizeProofUrls(values: Array<string | null | undefined> | null | undefined, legacy?: string | null): string[] {
  const result: string[] = [];
  for (const value of values ?? []) {
    if (typeof value !== 'string' || !value || result.includes(value)) continue;
    result.push(value);
  }
  if (!result.length && legacy) result.push(legacy);
  return result;
}

/** Validate attachment ownership inside the same transaction as the mutation.
 * An attacker must not attach another person's known object URL to their own
 * activity and thereby manufacture download permission. */
export async function assertAttachableProof(tx: Prisma.TransactionClient, value: string | null | undefined, actorId: string, existingValue?: string | null) {
  return assertAttachableProofs(tx, value ? [value] : [], actorId, existingValue ? [existingValue] : []);
}

export async function assertAttachableProofs(tx: Prisma.TransactionClient, values: string[] | null | undefined, actorId: string, existingValues: string[] = []) {
  const unique = normalizeProofUrls(values);
  if (unique.length > MAX_ACTIVITY_PROOFS) throw new ActivityEditError(`Attach up to ${MAX_ACTIVITY_PROOFS} proof photos.`, 400);
  const existing = new Set(existingValues.filter(Boolean));
  const actor = await tx.user.findUnique({ where: { id: actorId }, select: { role: true } });
  if (!actor) throw new ActivityEditError('Not authenticated.', 401);

  for (const value of unique) {
    if (existing.has(value)) continue; // Retain original external history unchanged.
    const reference = resolveProofReference(value);
    if (!reference) throw new ActivityEditError('Upload a proof image, or use a supported Google Drive / Strava proof link.', 400);
    if (actor.role === 'ADMIN' || reference.kind === 'external') continue;
    if (reference.kind === 'fixture' && !value.includes('/e2e-proof/')) continue;
    const bound = await tx.activity.findMany({
      where: { OR: [{ proofUrl: value }, { proofUrls: { has: value } }] },
      select: { userId: true }, take: 101,
    });
    if (bound.length) {
      if (!bound.some(row => row.userId === actorId)) throw new ActivityEditError('This proof belongs to another participant.', 403);
      continue;
    }
    const correctionBound = await tx.$queryRaw<Array<{ foreign_owner: boolean }>>`SELECT EXISTS (SELECT 1 FROM app_internal.activity_correction WHERE user_id<>${actorId} AND (original->>'proofUrl'=${value} OR proposed->>'proofUrl'=${value} OR applied->>'proofUrl'=${value})) AS foreign_owner`;
    if (correctionBound[0]?.foreign_owner) throw new ActivityEditError('This proof belongs to another participant.', 403);
    if (reference.path.split('/')[0] !== actorId) throw new ActivityEditError('Use a proof uploaded by your own account.', 403);
  }
}

/** Return no object metadata until the current app account has been checked. */
export async function mayReadProof(tx: Prisma.TransactionClient, value: string, actorId: string, reference: ProofReference): Promise<boolean> {
  const actor = await tx.user.findUnique({ where: { id: actorId }, select: { role: true } });
  if (!actor) return false;
  if (actor.role === 'ADMIN') return true;
  const owned = await tx.activity.findFirst({
    where: { userId: actorId, OR: [{ proofUrl: value }, { proofUrls: { has: value } }] },
    select: { id: true },
  });
  if (owned) return true;
  // Correction snapshots are private owner history, including proposed images.
  const corrections = await tx.$queryRaw<Array<{ found: boolean }>>`SELECT EXISTS (
    SELECT 1 FROM app_internal.activity_correction WHERE user_id=${actorId}
      AND (original->>'proofUrl'=${value} OR proposed->>'proofUrl'=${value} OR applied->>'proofUrl'=${value})
  ) AS found`;
  if (corrections[0]?.found) return true;
  if (reference.kind === 'external') return false;
  // Newly uploaded drafts are visible to the uploader only while unattached.
  if (reference.path.split('/')[0] !== actorId) return false;
  if (await tx.activity.findFirst({ where: { OR: [{ proofUrl: value }, { proofUrls: { has: value } }] }, select: { id: true } })) return false;
  const bound = await tx.$queryRaw<Array<{ found: boolean }>>`SELECT EXISTS (SELECT 1 FROM app_internal.activity_correction WHERE original->>'proofUrl'=${value} OR proposed->>'proofUrl'=${value} OR applied->>'proofUrl'=${value}) AS found`;
  return !bound[0]?.found;
}
