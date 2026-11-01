export const INTERVAL_REQUIRED_PROOF_COUNT = 2;
export const INTERVAL_PROOF_REQUIREMENT_MESSAGE = 'Interval runs require separate Work and Recovery photo proofs.';

export function hasRequiredIntervalProofs(runSegments: unknown, proofUrls: readonly unknown[]): boolean {
  if (!Array.isArray(runSegments) || runSegments.length === 0) return true;
  const uniqueProofs = new Set(
    proofUrls.filter((value): value is string => typeof value === 'string' && value.length > 0)
  );
  return uniqueProofs.size >= INTERVAL_REQUIRED_PROOF_COUNT;
}
